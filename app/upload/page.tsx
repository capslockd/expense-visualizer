import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import UploadFlow from "@/components/upload/UploadFlow";

export const metadata = { title: "Upload statement — Expense Visualizer" };

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/upload");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Upload a statement</h1>
      <p className="mt-1 text-sm text-zinc-500">
        PDF, CSV, Excel, or a photo/screenshot. Every transaction gets a
        category — you&apos;ll be asked about the ones the AI isn&apos;t sure of.
      </p>
      <div className="mt-6">
        <UploadFlow />
      </div>
    </main>
  );
}
