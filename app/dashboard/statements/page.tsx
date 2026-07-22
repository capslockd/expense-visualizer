import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStatements } from "@/lib/sheets/repo";
import { formatMoney } from "@/lib/analytics";
import ManageTabs from "@/components/dashboard/ManageTabs";
import {
  DeleteAllStatementsButton,
  DeleteStatementIcon,
} from "@/components/dashboard/DeleteButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statements — Expense Visualizer" };

export default async function StatementsListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/statements");
  const userId = session.user.id;

  const statements = await getStatements(userId);

  const sortedStatements = [...statements].sort((a, b) =>
    b.uploaded_at.localeCompare(a.uploaded_at),
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <ManageTabs active="statements" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Statements</h1>
        <Link
          href="/upload"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Upload a statement
        </Link>
      </div>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        {sortedStatements.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            No statements yet — upload your first credit card or bank
            statement to get started.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100">
              {sortedStatements.map((s) => {
                const dates =
                  s.period_start && s.period_end
                    ? `${s.period_start} → ${s.period_end}`
                    : null;
                const label = s.title || dates || s.source_filename;
                return (
                  <li key={s.id} className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/statements/${s.id}`}
                      className="flex flex-1 items-center justify-between gap-4 py-2.5 hover:bg-zinc-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{label}</p>
                        <p className="text-xs text-zinc-500">
                          {s.title && dates ? `${dates} · ` : ""}
                          {s.source_filename} · {s.transaction_count} txns
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm tabular-nums text-zinc-700">
                        {formatMoney(s.total_debits, s.currency)}
                      </span>
                    </Link>
                    <DeleteStatementIcon statementId={s.id} label={label} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-zinc-100 pt-3 text-right">
              <DeleteAllStatementsButton count={statements.length} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
