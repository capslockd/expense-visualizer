import { NextResponse } from "next/server";
import { z } from "zod";
import { registerWithPassword } from "@/lib/auth/users";

const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Name is required"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message } },
      { status: 400 },
    );
  }

  const { user, error } = await registerWithPassword(parsed.data);
  if (error || !user) {
    return NextResponse.json(
      { error: { code: "EMAIL_TAKEN", message: error ?? "Could not create account" } },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
