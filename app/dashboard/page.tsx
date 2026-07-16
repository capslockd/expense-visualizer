import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories, getStatements, getTransactions } from "@/lib/sheets/repo";
import {
  byMonth,
  currenciesOf,
  formatMoney,
  monthLabel,
  netByCategory,
  totalMoneyIn,
} from "@/lib/analytics";
import StatTiles, { Tile } from "@/components/dashboard/StatTiles";
import MonthlyTrendChart from "@/components/dashboard/MonthlyTrendChart";
import BudgetVsActual from "@/components/dashboard/BudgetVsActual";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Expense Visualizer" };

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
  const requested = typeof params.currency === "string" ? params.currency : null;
  const currency =
    requested && currencies.includes(requested) ? requested : currencies[0];
  const txns = allTxns.filter((t) => t.currency === currency);

  const monthly = byMonth(txns);
  const ranked = netByCategory(txns)
    .filter((c) => c.total > 0)
    .map((c) => c.category);

  const latest = monthly[monthly.length - 1];
  const previous = monthly.length > 1 ? monthly[monthly.length - 2] : null;

  const tiles: Tile[] = [];
  if (latest) {
    const delta = previous ? latest.total - previous.total : null;
    tiles.push({
      label: `Spend · ${monthLabel(latest.month)}`,
      value: formatMoney(latest.total, currency),
      sub:
        delta === null
          ? "first month on record"
          : `${delta >= 0 ? "+" : "−"}${formatMoney(Math.abs(delta), currency)} vs ${monthLabel(previous!.month)}`,
      subTone: delta === null ? "neutral" : delta > 0 ? "bad" : "good",
    });

    if (previous) {
      let mover: { category: string; diff: number } | null = null;
      const cats = new Set([
        ...Object.keys(latest.byCategory),
        ...Object.keys(previous.byCategory),
      ]);
      for (const c of cats) {
        const diff = (latest.byCategory[c] ?? 0) - (previous.byCategory[c] ?? 0);
        if (!mover || Math.abs(diff) > Math.abs(mover.diff)) {
          mover = { category: c, diff };
        }
      }
      if (mover) {
        tiles.push({
          label: "Biggest mover",
          value: mover.category,
          sub: `${mover.diff >= 0 ? "+" : "−"}${formatMoney(Math.abs(mover.diff), currency)} vs last month`,
          subTone: mover.diff > 0 ? "bad" : "good",
        });
      }
    }

    const topCat = netByCategory(
      txns.filter((t) => t.date.startsWith(latest.month)),
    )[0];
    if (topCat) {
      tiles.push({
        label: `Top category · ${monthLabel(latest.month)}`,
        value: topCat.category,
        sub: formatMoney(topCat.total, currency),
      });
    }

    tiles.push({
      label: "Money in (all time)",
      value: formatMoney(totalMoneyIn(txns), currency),
      sub: `${statements.length} statement${statements.length === 1 ? "" : "s"} uploaded`,
    });
  }

  // Budget vs actual for the latest month with data.
  const budgetRows = latest
    ? categories
        .filter((c) => (c.monthly_budget ?? 0) > 0)
        .map((c) => ({
          category: c.name,
          budget: c.monthly_budget as number,
          actual: Math.max(latest.byCategory[c.name] ?? 0, 0),
        }))
        .sort((a, b) => b.actual / b.budget - a.actual / a.budget)
    : [];

  const sortedStatements = [...statements].sort((a, b) =>
    b.uploaded_at.localeCompare(a.uploaded_at),
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {currencies.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            {currencies.map((c) => (
              <Link
                key={c}
                href={`/dashboard?currency=${c}`}
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

      <div className="mt-5">
        <StatTiles tiles={tiles} />
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Monthly spend by category
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Net of refunds · excludes card payments and transfers · {currency}
        </p>
        <MonthlyTrendChart
          data={monthly}
          rankedCategories={ranked}
          currency={currency}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Budget vs actual{latest ? ` · ${monthLabel(latest.month)}` : ""}
          </h2>
          <div className="mt-4">
            <BudgetVsActual
              rows={budgetRows}
              currency={currency}
              monthName={latest ? monthLabel(latest.month) : ""}
            />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Statements</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {sortedStatements.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/statements/${s.id}`}
                  className="flex items-center justify-between gap-4 py-2.5 hover:bg-zinc-50"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {s.period_start && s.period_end
                        ? `${s.period_start} → ${s.period_end}`
                        : s.source_filename}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {s.source_filename} · {s.transaction_count} txns
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm tabular-nums text-zinc-700">
                    {formatMoney(s.total_debits, s.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
