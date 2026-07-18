import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories, getStatements, getTransactions } from "@/lib/sheets/repo";
import {
  byMonth,
  byStatement,
  currenciesOf,
  formatMoney,
  monthLabel,
  netByCategory,
  txnInPeriod,
} from "@/lib/analytics";
import DashboardSections from "@/components/dashboard/DashboardSections";
import BudgetPanel from "@/components/dashboard/BudgetPanel";
import {
  DeleteAllStatementsButton,
  DeleteStatementIcon,
} from "@/components/dashboard/DeleteButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Expense Visualizer" };

/** Hard ceiling on chart columns rendered at once. */
const MAX_PERIODS = 24;
const SHOW_OPTIONS = [1, 3, 6, 12, 24] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard");
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
  const requestedCurrency =
    typeof params.currency === "string" ? params.currency : null;
  const currency =
    requestedCurrency && currencies.includes(requestedCurrency)
      ? requestedCurrency
      : currencies[0];
  const currencyTxns = allTxns.filter((t) => t.currency === currency);

  // Grouping: by statement period (the billing cycle) by default.
  const group = params.group === "month" ? "month" : "statement";
  const allPeriods =
    group === "month"
      ? byMonth(currencyTxns)
      : byStatement(currencyTxns, statements);

  // Visible-window filter — never render more than MAX_PERIODS columns.
  const requestedShow = Number(params.show);
  const show = (SHOW_OPTIONS as readonly number[]).includes(requestedShow)
    ? requestedShow
    : MAX_PERIODS;
  const periods = allPeriods.slice(-Math.min(show, MAX_PERIODS));
  const visibleKeys = new Set(periods.map((p) => p.key));
  const txns = currencyTxns.filter((t) =>
    [...visibleKeys].some((k) => txnInPeriod(t, group, k)),
  );

  const ranked = netByCategory(txns)
    .filter((c) => c.total > 0)
    .map((c) => c.category);

  const periodNoun = group === "statement" ? "statement" : "month";

  // Per-cycle budgets (used by the red budget line and the budget panel).
  const budgets: Record<string, number> = {};
  for (const c of categories) {
    if ((c.monthly_budget ?? 0) > 0) budgets[c.name] = c.monthly_budget as number;
  }
  // Pace gets both cuts regardless of the page grouping (statements usually
  // run mid-month → mid-month, so both levels are useful side by side).
  const statementPeriodsAll = group === "statement" ? allPeriods : byStatement(currencyTxns, statements);
  const monthPeriodsAll = group === "month" ? allPeriods : byMonth(currencyTxns);
  const statementPeriods = statementPeriodsAll.slice(-Math.min(show, MAX_PERIODS));
  const monthPeriods = monthPeriodsAll.slice(-Math.min(show, MAX_PERIODS));

  // The budget panel compares against the latest calendar month.
  const monthly = byMonth(currencyTxns);
  const latestMonth = monthly[monthly.length - 1];
  const latestMonthName = latestMonth ? monthLabel(latestMonth.key) : "";

  const sortedStatements = [...statements].sort((a, b) =>
    b.uploaded_at.localeCompare(a.uploaded_at),
  );

  const href = (over: { group?: string; show?: number; currency?: string }) => {
    const q = new URLSearchParams();
    q.set("group", over.group ?? group);
    q.set("show", String(over.show ?? show));
    if (currencies.length > 1) q.set("currency", over.currency ?? currency);
    return `/dashboard?${q.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            {(
              [
                ["statement", "By statement"],
                ["month", "By month"],
              ] as const
            ).map(([g, label]) => (
              <Link
                key={g}
                href={href({ group: g })}
                className={`rounded-md px-3 py-1 text-sm ${
                  g === group
                    ? "bg-zinc-900 font-medium text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            {SHOW_OPTIONS.map((n) => (
              <Link
                key={n}
                href={href({ show: n })}
                title={`Show the last ${n} ${periodNoun}s`}
                className={`rounded-md px-3 py-1 text-sm ${
                  n === show
                    ? "bg-zinc-900 font-medium text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {n}
              </Link>
            ))}
          </div>

          {currencies.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
              {currencies.map((c) => (
                <Link
                  key={c}
                  href={href({ currency: c })}
                  className={`rounded-md px-3 py-1 text-sm ${
                    c === currency
                      ? "bg-zinc-900 font-medium text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {c}
                </Link>
              ))}
            </div>
          )}
        </div>
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
          allCurrencyTxns={currencyTxns}
          currency={currency}
          group={group}
          budgets={budgets}
          categoryNames={categories.map((c) => c.name)}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Budget vs actual{latestMonthName ? ` · ${latestMonthName}` : ""}
            <span className="ml-1 font-normal text-zinc-400">
              (per cycle — month or statement)
            </span>
          </h2>
          <div className="mt-4">
            <BudgetPanel
              categories={categories.map((c) => ({
                name: c.name,
                monthly_budget: c.monthly_budget,
              }))}
              actualByCategory={latestMonth?.byCategory ?? {}}
              currency={currency}
              monthName={latestMonthName}
            />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Statements</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
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
                        {s.transaction_count} txns
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
        </section>
      </div>
    </main>
  );
}
