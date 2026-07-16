import { ExtractionError } from "@/lib/anthropic/extract";
import { ExtractionResult } from "@/lib/anthropic/schema";
import { normalizeMerchant } from "@/lib/categorize/normalize";
import { Category } from "@/lib/types";
import { basicParse } from "./parse";
import { matchKeyword } from "./keywords";

/** Light display cleanup — strip processor prefixes and trailing reference codes. */
function cleanDisplayMerchant(description: string): string {
  let s = description
    .replace(/^(SQ|TST|PP|PAYPAL|POS|IZ|EZY|SP)\s*\*\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop trailing long reference tokens: "GRAB* RIDE 7XKQP SG" → keep words, drop pure refs
  s = s.replace(/\s+[A-Z0-9]{10,}$/i, "").trim();
  return s || description.trim();
}

/**
 * Non-AI extraction: deterministic CSV/Excel parsing + keyword-dictionary
 * categorization. Anything without a confident keyword match is flagged
 * needs_review — the review gate does the rest. Returns the same shape as
 * the AI path so the route's downstream handling is identical.
 */
export function basicExtract(
  text: string,
  categories: Category[],
): ExtractionResult {
  const parsed = basicParse(text);
  if (!parsed || parsed.transactions.length === 0) {
    throw new ExtractionError(
      "BASIC_PARSE_FAILED",
      "Couldn't find transactions in this file. The basic (no-AI) parser needs a CSV/Excel export with date, description, and amount columns — or add Anthropic credits to parse any format with AI.",
    );
  }

  const validCategories = new Set(categories.map((c) => c.name));
  const warnings = [...parsed.warnings];
  let currency = parsed.currency;
  if (!currency) {
    currency = "USD";
    warnings.push(
      "Couldn't detect the statement currency — defaulted to USD. Fix it with the currency selector above the table if that's wrong.",
    );
  }

  return {
    document_status: "ok",
    period_start: parsed.period_start,
    period_end: parsed.period_end,
    statement_currency: currency,
    account_hint: null,
    warnings,
    transactions: parsed.transactions.map((t) => {
      const merchant = cleanDisplayMerchant(t.description);
      const keywordCategory = matchKeyword(
        normalizeMerchant(t.description),
        validCategories,
      );
      return {
        date: t.date,
        description: t.description,
        merchant,
        amount: t.amount,
        direction: t.direction,
        currency: currency as string,
        proposed_category: keywordCategory,
        needs_review: keywordCategory === null,
        confidence_note: keywordCategory === null ? "no keyword match" : null,
      };
    }),
  };
}
