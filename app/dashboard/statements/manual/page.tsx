import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories } from "@/lib/sheets/repo";
import ManualEntryFlow from "@/components/upload/ManualEntryFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add transactions manually — Expense Visualizer" };

export default async function ManualEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/statements/manual");
  const userId = session.user.id;

  const categories = await getCategories(userId);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Add transactions manually</h1>
      <p className="mt-1 text-sm text-zinc-500">
        No file needed — enter each expense or income transaction directly.
        Every row still needs a category before you can save.
      </p>
      <div className="mt-6">
        <ManualEntryFlow
          initialCategories={categories.map((c) => ({ name: c.name, type: c.type }))}
        />
      </div>
    </main>
  );
}
