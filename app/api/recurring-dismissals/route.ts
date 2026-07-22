import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { dismissRecurring, undismissRecurring } from "@/lib/sheets/repo";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const BodySchema = z.object({ merchant_normalized: z.string().min(1) });

async function parseBody(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: apiError(400, "INVALID_BODY", "Invalid JSON body.") };
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return { error: apiError(400, "INVALID_INPUT", "merchant_normalized is required.") };
  }
  return { data: parsed.data };
}

/** Dismiss a merchant flagged as recurring — hides it from the Trends Dashboard's recurring list. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  const parsed = await parseBody(req);
  if (parsed.error) return parsed.error;

  await dismissRecurring(userId, parsed.data.merchant_normalized);
  return NextResponse.json({ ok: true });
}

/** Restore a previously-dismissed merchant. */
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError(401, "UNAUTHORIZED", "Sign in first.");

  const parsed = await parseBody(req);
  if (parsed.error) return parsed.error;

  await undismissRecurring(userId, parsed.data.merchant_normalized);
  return NextResponse.json({ ok: true });
}
