import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories, getStatements, getTransactions } from "@/lib/sheets/repo";
import {
  byMonth,
  byStatement,
  currenciesOf,
  netByCategory,
  partitionByType,
  txnInPeriod,
} from "@/lib/analytics";
import { MAX_PERIODS, resolveDashboardParams } from "@/lib/dashboard/params";
import DashboardSections from "@/components/dashboard/DashboardSections";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import DashboardControls from "@/components/dashboard/DashboardControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Income Dashboard — Expense Visualizer" };

export default async function IncomeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/income");
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
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Upload a statement
          </Link>
          <Link
            href="/dashboard/statements/manual"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Add manually
          </Link>
        </div>
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
  const excludedCategoryNames = new Set(
    categories.filter((c) => c.excluded).map((c) => c.name),
  );
  const { income: incomeTxns } = partitionByType(
    currencyTxns,
    incomeCategoryNames,
    excludedCategoryNames,
  );

  if (incomeTxns.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <DashboardTabs active="income" />
        <div className="mt-16 flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold">No income yet</h1>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            Every transaction here has been an expense so far. Upload a
            statement with salary, business, or marketplace deposits — or
            open a transaction on the{" "}
            <Link href="/dashboard" className="underline hover:text-zinc-700">
              Expense Dashboard
            </Link>{" "}
            and recategorize it into an income category (Salary, Business,
            eBay, Website, and more) to see it here.
          </p>
          <Link
            href="/upload"
            className="mt-6 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Upload a statement
          </Link>
        </div>
      </main>
    );
  }

  const allPeriods =
    group === "month" ? byMonth(incomeTxns, "credit") : byStatement(incomeTxns, statements, "credit");

  const periods = allPeriods.slice(-Math.min(show, MAX_PERIODS));
  const visibleKeys = new Set(periods.map((p) => p.key));
  const txns = incomeTxns.filter((t) =>
    [...visibleKeys].some((k) => txnInPeriod(t, group, k)),
  );

  const ranked = netByCategory(txns, "credit")
    .filter((c) => c.total > 0)
    .map((c) => c.category);

  const periodNoun = group === "statement" ? "statement" : "month";

  const statementPeriodsAll =
    group === "statement" ? allPeriods : byStatement(incomeTxns, statements, "credit");
  const monthPeriodsAll = group === "month" ? allPeriods : byMonth(incomeTxns, "credit");
  const statementPeriods = statementPeriodsAll.slice(-Math.min(show, MAX_PERIODS));
  const monthPeriods = monthPeriodsAll.slice(-Math.min(show, MAX_PERIODS));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <DashboardTabs active="income" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Income Dashboard</h1>
        <DashboardControls
          basePath="/dashboard/income"
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

      <div className="mt-5">
        <DashboardSections
          periods={periods}
          statementPeriods={statementPeriods}
          monthPeriods={monthPeriods}
          rankedCategories={ranked}
          txns={txns}
          allCurrencyTxns={incomeTxns}
          currency={currency}
          group={group}
          budgets={{}}
          categoryNames={categories.map((c) => ({ name: c.name, type: c.type }))}
          mode="income"
        />
      </div>
    </main>
  );
}
