import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  addCategory,
  getCategories,
  updateCategoryBudget,
} from "@/lib/sheets/repo";
import { FORBIDDEN_CATEGORY_NAMES } from "@/lib/types";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function toResponseShape(c: { name: string; monthly_budget: number | null; type: string }) {
  return { name: c.name, monthly_budget: c.monthly_budget, type: c.type };
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

const BudgetSchema = z.object({
  name: z.string().trim().min(1),
  monthly_budget: z.number().nonnegative().nullable(),
});

/** Set or clear a category's per-cycle budget. */
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.");
  }
  const parsed = BudgetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "name and monthly_budget (number or null) required.");
  }
  const budget =
    parsed.data.monthly_budget === 0 ? null : parsed.data.monthly_budget;
  const ok = await updateCategoryBudget(userId, parsed.data.name, budget);
  if (!ok) {
    return apiError(404, "NOT_FOUND", `Category "${parsed.data.name}" not found.`);
  }
  return NextResponse.json({ ok: true });
}
