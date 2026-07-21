import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories, getStatements, getTransactions } from "@/lib/sheets/repo";
import { byMonth, byStatement, currenciesOf, partitionByType } from "@/lib/analytics";
import { MAX_PERIODS, resolveDashboardParams } from "@/lib/dashboard/params";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import DashboardControls from "@/components/dashboard/DashboardControls";
import IncomeExpenseExplorer from "@/components/dashboard/IncomeExpenseExplorer";
import { IncomeExpensePoint } from "@/components/dashboard/IncomeExpenseChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Income vs Expenditure — Expense Visualizer" };

export default async function IncomeVsExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/income-vs-expense");
  const userId = session.user.id;

  const [allTxns, statements, categories] = await Promise.all([
    getTransactions(userId),
    getStatements(userId),
    getCategories(userId),
  ]);

  if (statements.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">No statements yet</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Upload your first credit card or bank statement and every transaction
          will be extracted, categorized, and tracked here.
        </p>
        <Link
          href="/upload"
          className="mt-6 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Upload a statement
        </Link>
      </main>
    );
  }

  const params = await searchParams;
  const currencies = currenciesOf(allTxns);
  const { currency, group, show } = resolveDashboardParams(params, currencies);
  const currencyTxns = allTxns.filter((t) => t.currency === currency);

  const incomeCategoryNames = new Set(
    categories.filter((c) => c.type === "income").map((c) => c.name),
  );
  const { expense: expenseTxns, income: incomeTxns } = partitionByType(
    currencyTxns,
    incomeCategoryNames,
  );

  // Canonical period list (keys/labels/order) — from every transaction
  // regardless of type, so a period with only income or only expenses still
  // gets its own column.
  const allPeriods =
    group === "month" ? byMonth(currencyTxns) : byStatement(currencyTxns, statements);
  const periods = allPeriods.slice(-Math.min(show, MAX_PERIODS));

  const expensePeriods =
    group === "month" ? byMonth(expenseTxns) : byStatement(expenseTxns, statements);
  const incomePeriods =
    group === "month"
      ? byMonth(incomeTxns, "credit")
      : byStatement(incomeTxns, statements, "credit");
  const expenseByKey = new Map(expensePeriods.map((p) => [p.key, p.total]));
  const incomeByKey = new Map(incomePeriods.map((p) => [p.key, p.total]));

  const data: IncomeExpensePoint[] = periods.map((p) => ({
    key: p.key,
    label: p.label,
    income: incomeByKey.get(p.key) ?? 0,
    expense: expenseByKey.get(p.key) ?? 0,
  }));

  const periodNoun = group === "statement" ? "statement" : "month";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <DashboardTabs active="overview" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Income vs Expenditure</h1>
        <DashboardControls
          basePath="/dashboard/income-vs-expense"
          group={group}
          show={show}
          currency={currency}
          currencies={currencies}
          periodNoun={periodNoun}
        />
      </div>
      {allPeriods.length > periods.length && (
        <p className="mt-1 text-xs text-zinc-400">
          Showing the latest {periods.length} of {allPeriods.length} {periodNoun}s
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        Is there enough income to cover expenses in a given {periodNoun}?
      </p>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <IncomeExpenseExplorer data={data} currency={currency} periodNoun={periodNoun} />
      </div>
    </main>
  );
}
