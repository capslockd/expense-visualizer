import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCategories,
  getDismissedRecurring,
  getStatements,
  getTransactions,
} from "@/lib/sheets/repo";
import {
  byMonth,
  currenciesOf,
  detectRecurringMerchants,
  partitionByType,
  yearInReview,
} from "@/lib/analytics";
import { MAX_PERIODS, resolveDashboardParams } from "@/lib/dashboard/params";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import DashboardControls from "@/components/dashboard/DashboardControls";
import TrendsSections from "@/components/dashboard/TrendsSections";
import { SavingsRatePoint } from "@/components/dashboard/SavingsRateChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trends Dashboard — Expense Visualizer" };

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/trends");
  const userId = session.user.id;

  const [allTxns, statements, categories, dismissedSet] = await Promise.all([
    getTransactions(userId),
    getStatements(userId),
    getCategories(userId),
    getDismissedRecurring(userId),
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
  const { currency, show } = resolveDashboardParams(params, currencies);
  const currencyTxns = allTxns.filter((t) => t.currency === currency);

  const incomeCategoryNames = new Set(
    categories.filter((c) => c.type === "income").map((c) => c.name),
  );
  const excludedCategoryNames = new Set(
    categories.filter((c) => c.excluded).map((c) => c.name),
  );
  // Full history for this currency — Recurring/Year-in-review/Explorer all
  // use these slices directly (not the show-windowed periods below).
  const { expense: expenseTxns, income: incomeTxns } = partitionByType(
    currencyTxns,
    incomeCategoryNames,
    excludedCategoryNames,
  );

  if (expenseTxns.length === 0 && incomeTxns.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <DashboardTabs active="trends" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Trends Dashboard</h1>
        </div>
        <p className="mt-8 text-center text-sm text-zinc-500">
          No {currency} transactions yet — trends need at least a little spending or income
          history to work with.
        </p>
      </main>
    );
  }

  // Always month-based, never by statement: expense and income arrive on
  // different statement cadences for real usage here (monthly card
  // statements vs a quarterly income/savings statement), so bucketing by
  // statement_id would pair a quarter of income against a single month of
  // expenses. Calendar months are the only unit both sides share.
  const periodNoun = "month";

  const trackedTxns = [...expenseTxns, ...incomeTxns];
  const allPeriods = byMonth(trackedTxns);
  const periods = allPeriods.slice(-Math.min(show, MAX_PERIODS));

  const expensePeriods = byMonth(expenseTxns);
  const incomePeriods = byMonth(incomeTxns, "credit");
  const expenseByKey = new Map(expensePeriods.map((p) => [p.key, p.total]));
  const incomeByKey = new Map(incomePeriods.map((p) => [p.key, p.total]));

  const savingsRateData: SavingsRatePoint[] = [];
  let cumulativeSavings = 0;
  for (const p of periods) {
    const income = incomeByKey.get(p.key) ?? 0;
    const expense = expenseByKey.get(p.key) ?? 0;
    const net = Math.round((income - expense) * 100) / 100;
    cumulativeSavings = Math.round((cumulativeSavings + net) * 100) / 100;
    const pct = income > 0 ? ((income - expense) / income) * 100 : null;
    savingsRateData.push({
      key: p.key,
      label: p.label,
      income,
      expense,
      rate: pct === null ? null : Math.round(pct * 100) / 100,
      cumulativeSavings,
    });
  }

  // Sections 1 & 2 always use full history, never the show-windowed subset —
  // capping recurring/annual detection to a narrow window would defeat them.
  const recurring = detectRecurringMerchants(expenseTxns);
  const years = yearInReview(expenseTxns, incomeTxns);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <DashboardTabs active="trends" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Trends Dashboard</h1>
        <DashboardControls
          basePath="/dashboard/trends"
          group="month"
          show={show}
          currency={currency}
          currencies={currencies}
          periodNoun={periodNoun}
          showGroupToggle={false}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        The window control above only scopes the Savings rate section below, which is always
        shown month by month — expense and income statements arrive on different cadences, so
        months are the only unit both sides line up on. Recurring, Year in review, and
        Transaction explorer always look at your full history.
      </p>
      {allPeriods.length > periods.length && (
        <p className="mt-1 text-xs text-zinc-400">
          Savings rate is showing the latest {periods.length} of {allPeriods.length} {periodNoun}s
        </p>
      )}

      <TrendsSections
        currency={currency}
        categoryNames={categories.map((c) => ({ name: c.name, type: c.type }))}
        recurring={recurring}
        dismissedMerchants={[...dismissedSet]}
        expenseTxns={expenseTxns}
        years={years}
        savingsRateData={savingsRateData}
        periodNoun={periodNoun}
        merchantExplorerTxns={trackedTxns}
      />
    </main>
  );
}
