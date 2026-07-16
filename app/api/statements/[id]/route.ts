import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { deleteStatementData } from "@/lib/sheets/repo";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in first." } },
      { status: 401 },
    );
  }
  const { id } = await params;
  const result = await deleteStatementData(userId, id);
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Statement not found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
