import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { deleteTransactions } from "@/lib/sheets/repo";

const DeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

/** Bulk-delete transactions by id, e.g. a multi-select on a statement's transaction table. */
export async function DELETE(req: Request) {
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
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "ids must be a non-empty array of strings." } },
      { status: 400 },
    );
  }

  const result = await deleteTransactions(userId, parsed.data.ids);
  if (result.deleted === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "None of those transactions were found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, deleted: result.deleted });
}
