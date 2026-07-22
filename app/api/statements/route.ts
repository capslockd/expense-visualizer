import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { statementFingerprint } from "@/lib/fingerprint";
import {
  deleteAllStatementData,
  findStatementByHash,
  getCategories,
  getRules,
  getStatements,
  saveStatement,
} from "@/lib/sheets/repo";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const SaveSchema = z.object({
  statement: z.object({
    period_start: z.string().nullable(),
    period_end: z.string().nullable(),
    currency: z.string().min(1),
    source_filename: z.string().min(1),
    // Omitted for manually-entered statements (no /api/extract step ran to
    // compute one) — derived server-side below from the transactions instead.
    content_hash: z.string().min(1).optional(),
    title: z.string().trim().max(80).optional(),
  }),
  transactions: z
    .array(
      z.object({
        tempId: z.string(),
        date: z.string().min(1),
        description: z.string(),
        merchant: z.string().min(1),
        merchant_normalized: z.string().min(1),
        amount: z.number().positive(),
        direction: z.enum(["debit", "credit"]),
        currency: z.string().min(1),
        category: z.string(),
        categorized_by: z.enum(["ai", "rule", "user", "keyword"]),
        remember: z.boolean().optional(),
        ai_proposal: z.string().nullable(),
      }),
    )
    .min(1),
  allowDuplicate: z.boolean().optional(),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");
  const statements = await getStatements(userId);
  return NextResponse.json({ statements });
}

/** Delete ALL of the signed-in user's statements and transactions. */
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");
  // Deliberate friction for a destructive bulk action.
  const confirm = new URL(req.url).searchParams.get("confirm");
  if (confirm !== "all") {
    return apiError(400, "CONFIRM_REQUIRED", "Pass ?confirm=all to delete every statement.");
  }
  const result = await deleteAllStatementData(userId);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.");
  }
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { statement, transactions, allowDuplicate } = parsed.data;

  // THE hard guarantee: every transaction must carry a real category.
  const categories = await getCategories(userId);
  const valid = new Set(categories.map((c) => c.name));
  const unresolved = transactions
    .filter((t) => !t.category || !valid.has(t.category))
    .map((t) => t.tempId);
  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "UNRESOLVED_CATEGORIES",
          message: `${unresolved.length} transaction(s) still need a valid category.`,
        },
        unresolved,
      },
      { status: 422 },
    );
  }

  // Manual entries never went through /api/extract, so they arrive with no
  // content_hash — derive one from the same (now-validated) transactions.
  const content_hash =
    statement.content_hash ??
    statementFingerprint({
      period_start: statement.period_start,
      period_end: statement.period_end,
      account_hint: null,
      transactions,
    });

  // Duplicate gate (per user).
  if (!allowDuplicate) {
    const dup = await findStatementByHash(userId, content_hash);
    if (dup) {
      return apiError(
        409,
        "DUPLICATE_STATEMENT",
        `This statement looks identical to one uploaded on ${dup.uploaded_at.slice(0, 10)}.`,
      );
    }
  }

  // Derive new rules server-side: anything the user decided that differs from
  // the AI proposal (or that the AI couldn't decide), unless remember === false.
  const existingRules = await getRules(userId);
  const newRules = new Map<string, string>();
  for (const t of transactions) {
    if (t.remember === false) continue;
    const userDecided = t.ai_proposal === null || t.category !== t.ai_proposal;
    if (!userDecided) continue;
    if (existingRules.get(t.merchant_normalized) === t.category) continue;
    newRules.set(t.merchant_normalized, t.category);
  }

  const { statement_id } = await saveStatement({
    userId,
    statement: {
      period_start: statement.period_start ?? "",
      period_end: statement.period_end ?? "",
      source_filename: statement.source_filename,
      currency: statement.currency,
      content_hash,
      title: statement.title ?? "",
    },
    transactions: transactions.map((t) => ({
      date: t.date,
      description: t.description,
      merchant: t.merchant,
      merchant_normalized: t.merchant_normalized,
      amount: t.amount,
      direction: t.direction,
      currency: t.currency,
      category: t.category,
      categorized_by: t.categorized_by,
    })),
    newRules: [...newRules.entries()].map(([merchant_normalized, category]) => ({
      merchant_normalized,
      category,
    })),
  });

  return NextResponse.json({ statement_id }, { status: 201 });
}
