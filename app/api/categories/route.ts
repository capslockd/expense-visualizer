import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  addCategory,
  getCategories,
  updateCategoryBudget,
  updateCategoryExcluded,
} from "@/lib/sheets/repo";
import { FORBIDDEN_CATEGORY_NAMES } from "@/lib/types";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function toResponseShape(c: {
  name: string;
  monthly_budget: number | null;
  type: string;
  excluded: boolean;
}) {
  return {
    name: c.name,
    monthly_budget: c.monthly_budget,
    type: c.type,
    excluded: c.excluded,
  };
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");
  const categories = await getCategories(userId);
  return NextResponse.json({ categories: categories.map(toResponseShape) });
}

const AddSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(["expense", "income"]),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.");
  }
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "Category name must be 1–40 characters.");
  }
  const { name, type } = parsed.data;

  // The hard requirement extends to user-created categories: no catch-alls.
  if (FORBIDDEN_CATEGORY_NAMES.includes(name.toLowerCase())) {
    return apiError(
      400,
      "FORBIDDEN_NAME",
      `"${name}" isn't allowed — every expense needs a specific category. Create one that describes the purchase instead.`,
    );
  }

  const existing = await getCategories(userId);
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return apiError(409, "DUPLICATE_CATEGORY", `"${name}" already exists.`);
  }

  await addCategory(userId, name, type);
  const categories = await getCategories(userId);
  return NextResponse.json(
    { categories: categories.map(toResponseShape) },
    { status: 201 },
  );
}

const PatchSchema = z
  .object({
    name: z.string().trim().min(1),
    monthly_budget: z.number().nonnegative().nullable().optional(),
    /** Hide this category from every dashboard entirely (card payments, ATM withdrawals, transfers, ...). */
    excluded: z.boolean().optional(),
  })
  .refine((v) => v.monthly_budget !== undefined || v.excluded !== undefined, {
    message: "monthly_budget or excluded is required.",
  });

/** Update a category's per-cycle budget and/or whether it's excluded from every dashboard. */
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.");
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "name and (monthly_budget or excluded) required.");
  }
  const { name, monthly_budget, excluded } = parsed.data;

  if (monthly_budget !== undefined) {
    const budget = monthly_budget === 0 ? null : monthly_budget;
    const ok = await updateCategoryBudget(userId, name, budget);
    if (!ok) return apiError(404, "NOT_FOUND", `Category "${name}" not found.`);
  }
  if (excluded !== undefined) {
    const ok = await updateCategoryExcluded(userId, name, excluded);
    if (!ok) return apiError(404, "NOT_FOUND", `Category "${name}" not found.`);
  }
  return NextResponse.json({ ok: true });
}
