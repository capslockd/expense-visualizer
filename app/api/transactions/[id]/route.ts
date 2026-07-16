import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  appendRules,
  getCategories,
  getRules,
  updateTransactionCategory,
} from "@/lib/sheets/repo";

const PatchSchema = z.object({
  category: z.string().min(1),
  /** Also remember merchant → category for future statements (default true). */
  remember: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in first." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "category is required." } },
      { status: 400 },
    );
  }
  const { category, remember } = parsed.data;

  const categories = await getCategories(userId);
  if (!categories.some((c) => c.name === category)) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_CATEGORY", message: `"${category}" is not one of your categories.` } },
      { status: 422 },
    );
  }

  const { id } = await params;
  const result = await updateTransactionCategory(userId, id, category);
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Transaction not found." } },
      { status: 404 },
    );
  }

  if (remember !== false && result.merchant_normalized) {
    const existing = await getRules(userId);
    if (existing.get(result.merchant_normalized) !== category) {
      await appendRules(userId, [
        { merchant_normalized: result.merchant_normalized, category },
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}
