import crypto from "node:crypto";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUserId } from "@/lib/auth";
import { intakeFile } from "@/lib/files/intake";
import { extractStatement, ExtractionError } from "@/lib/anthropic/extract";
import { basicExtract } from "@/lib/basic/extract";
import { normalizeMerchant } from "@/lib/categorize/normalize";
import { applyRules } from "@/lib/categorize/rules";
import { statementFingerprint } from "@/lib/fingerprint";
import {
  findStatementByHash,
  getCategories,
  getRules,
} from "@/lib/sheets/repo";
import { ExtractedTxn, ExtractResponse } from "@/lib/types";

export const maxDuration = 300;

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** AI is unusable for reasons Basic parsing can work around. */
function aiUnavailable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return String(err.message).includes("credit balance is too low");
  }
  return err instanceof Error && err.message.includes("ANTHROPIC_API_KEY is not set");
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in to upload statements.");

  let file: File | null = null;
  let requestedEngine: "ai" | "basic" = "ai";
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
    if (form.get("parser") === "basic") requestedEngine = "basic";
  } catch {
    // fall through to the null check
  }
  if (!file) return apiError(400, "NO_FILE", "Attach a statement file in the 'file' field.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const intake = intakeFile(buffer, file.name);
  if (intake.kind === "error") {
    return apiError(400, intake.code, intake.message);
  }
  if (requestedEngine === "basic" && intake.kind !== "text") {
    return apiError(
      400,
      "BASIC_NEEDS_TEXT",
      "Basic (no-AI) parsing works with CSV and Excel files only. PDFs and images need AI parsing.",
    );
  }

  try {
    const [categories, rules] = await Promise.all([
      getCategories(userId),
      getRules(userId),
    ]);

    let parsed;
    let engineUsed: "ai" | "basic" = requestedEngine;
    if (requestedEngine === "basic") {
      parsed = basicExtract((intake as { text: string }).text, categories);
    } else {
      try {
        parsed = await extractStatement(intake, categories, rules);
      } catch (err) {
        // No credits / no key? CSV and Excel can still go through the basic engine.
        if (aiUnavailable(err) && intake.kind === "text") {
          parsed = basicExtract(intake.text, categories);
          engineUsed = "basic";
          parsed.warnings.unshift(
            "AI parsing is unavailable (no Anthropic API credits), so the basic parser was used — more transactions may need manual categorization.",
          );
        } else {
          throw err;
        }
      }
    }

    const transactions: ExtractedTxn[] = parsed.transactions.map((t) => ({
      tempId: crypto.randomUUID(),
      date: t.date,
      description: t.description,
      merchant: t.merchant,
      merchant_normalized: normalizeMerchant(t.merchant),
      amount: Math.abs(t.amount),
      direction: t.direction,
      currency: t.currency || parsed.statement_currency,
      category: t.proposed_category,
      needs_review: t.needs_review,
      categorized_by:
        engineUsed === "basic" && t.proposed_category ? "keyword" : "ai",
      confidence_note: t.confidence_note,
    }));

    const validCategories = new Set(categories.map((c) => c.name));
    applyRules(transactions, rules, validCategories);

    const content_hash = statementFingerprint({
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      account_hint: parsed.account_hint,
      transactions,
    });
    const duplicate = await findStatementByHash(userId, content_hash);

    const body: ExtractResponse = {
      statement: {
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        currency: parsed.statement_currency,
        source_filename: file.name,
        account_hint: parsed.account_hint,
        content_hash,
        duplicate_of: duplicate?.id ?? null,
      },
      transactions,
      warnings: parsed.warnings,
      categories: categories.map((c) => c.name),
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof ExtractionError) {
      const status = err.code === "EXTRACTION_FAILED" ? 502 : 400;
      return apiError(status, err.code, err.message);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return apiError(429, "RATE_LIMITED", "The AI service is busy — try again in a minute.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", err.status, err.message);
      if (String(err.message).includes("credit balance is too low")) {
        return apiError(
          402,
          "NO_API_CREDITS",
          "Your Anthropic account is out of API credits. Add credits in the Anthropic Console (Plans & Billing), then try again.",
        );
      }
      return apiError(502, "EXTRACTION_FAILED", "The AI service returned an error. Try again shortly.");
    }
    console.error("extract failed:", err);
    return apiError(500, "INTERNAL", "Something went wrong processing the statement.");
  }
}
