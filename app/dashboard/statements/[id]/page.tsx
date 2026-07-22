import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCategories,
  getStatementById,
  getTransactionsByStatement,
} from "@/lib/sheets/repo";
import {
  formatMoney,
  netByCategory,
  partitionByType,
  statementLabel,
  topMerchants,
  totalNetSpend,
} from "@/lib/analytics";
import StatTiles, { Tile } from "@/components/dashboard/StatTiles";
import StatementExplorer from "@/components/dashboard/StatementExplorer";
import TopMerchants from "@/components/dashboard/TopMerchants";
import EditableTxnTable from "@/components/dashboard/EditableTxnTable";
import { DeleteStatementButton } from "@/components/dashboard/DeleteButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statement — Expense Visualizer" };

export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard");
  const userId = session.user.id;

  const { id } = await params;
  const statement = await getStatementById(userId, id);
  if (!statement) notFound();

  const [txns, categories] = await Promise.all([
    getTransactionsByStatement(userId, id),
    getCategories(userId),
  ]);
  const currency = statement.currency || txns[0]?.currency || "AUD";
  const categoryNames = categories.map((c) => ({ name: c.name, type: c.type }));

  const incomeCategoryNames = new Set(
    categories.filter((c) => c.type === "income").map((c) => c.name),
  );
  const excludedCategoryNames = new Set(
    categories.filter((c) => c.excluded).map((c) => c.name),
  );
  const { expense: expenseTxns, income: incomeTxns } = partitionByType(
    txns,
    incomeCategoryNames,
    excludedCategoryNames,
  );

  const breakdown = netByCategory(expenseTxns);
  const top = breakdown[0];

  const tiles: Tile[] = [
    {
      label: "Net spend",
      value: formatMoney(totalNetSpend(expenseTxns), currency),
      sub: "refunds netted, payments excluded",
    },
    {
      label: "Most expensive category",
      value: top?.category ?? "—",
      sub: top ? formatMoney(top.total, currency) : undefined,
    },
    { label: "Transactions", value: String(txns.length) },
    {
      label: "Money in",
      value: formatMoney(totalNetSpend(incomeTxns, "credit"), currency),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Link
        href="/dashboard/statements"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Statements
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {statement.title ||
              (statement.period_start && statement.period_end
                ? `${statement.period_start} → ${statement.period_end}`
                : statement.source_filename)}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {statement.title && statement.period_start && statement.period_end
              ? `${statement.period_start} → ${statement.period_end} · `
              : ""}
            {statement.source_filename} · uploaded{" "}
            {statement.uploaded_at.slice(0, 10)} · {currency}
          </p>
        </div>
        <DeleteStatementButton
          statementId={statement.id}
          label={statementLabel(statement)}
          redirectTo="/dashboard/statements"
        />
      </div>

      <div className="mt-5">
        <StatTiles tiles={tiles} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Spending by category
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            Net of refunds · click a category to see its transactions
          </p>
          <StatementExplorer
            breakdown={breakdown}
            txns={expenseTxns}
            currency={currency}
            categories={categoryNames}
          />
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            Top merchants
          </h2>
          <TopMerchants rows={topMerchants(expenseTxns)} currency={currency} />
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">
          All transactions ({txns.length})
        </h2>
        <EditableTxnTable txns={txns} categories={categoryNames} />
      </section>
    </main>
  );
}
