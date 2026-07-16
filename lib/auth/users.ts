import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByEmail,
  updateUserAuth,
} from "@/lib/sheets/repo";
import { User } from "@/lib/types";

export async function registerWithPassword(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user?: User; error?: string }> {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);

  if (existing) {
    if (existing.password_hash) {
      return { error: "An account with this email already exists. Try logging in." };
    }
    // Google-only account adding a password → link.
    const password_hash = await bcrypt.hash(input.password, 10);
    await updateUserAuth(email, { password_hash, auth_provider: "both" });
    return { user: { ...existing, password_hash, auth_provider: "both" } };
  }

  const password_hash = await bcrypt.hash(input.password, 10);
  const user = await createUser({
    email,
    name: input.name,
    password_hash,
    auth_provider: "credentials",
  });
  return { user };
}

export async function verifyPassword(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.password_hash) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

/** Find-or-create for Google sign-ins; links to an existing password account by email. */
export async function upsertGoogleUser(
  email: string,
  name: string,
): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.auth_provider === "credentials") {
      await updateUserAuth(email, { auth_provider: "both" });
      return { ...existing, auth_provider: "both" };
    }
    return existing;
  }
  return createUser({
    email,
    name,
    password_hash: "",
    auth_provider: "google",
  });
}
