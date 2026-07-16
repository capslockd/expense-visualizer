import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, googleAuthEnabled } from "@/lib/auth";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = { title: "Sign up — Expense Visualizer" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Suspense>
        <AuthForm mode="signup" googleEnabled={googleAuthEnabled()} />
      </Suspense>
    </main>
  );
}
