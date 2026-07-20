"use client";

import { useMemo, useState } from "react";
import { Txn } from "@/lib/types";
import { Period } from "@/lib/analytics";
import DashboardInteractive from "./DashboardInteractive";
import PaceExplorer from "./PaceExplorer";
import TopMerchantViz from "./TopMerchantViz";

/**
 * Owns the category filter so every section aligns to it: the Spend-by-
 * category chart (bars/pie), Spending pace, Highest-spend days, Spending by
 * day of week, and Top merchants all show only the selected categories.
 */
export default function DashboardSections({
  periods,
  statementPeriods,
  monthPeriods,
  rankedCategories,
  txns,
  allCurrencyTxns,
  currency,
  group,
  budgets,
  categoryNames,
}: {
  periods: Period[];
  statementPeriods: Period[];
  monthPeriods: Period[];
  rankedCategories: string[];
  /** Transactions inside the visible window (page grouping). */
  txns: Txn[];
  /** All transactions for this currency (pace needs both period cuts). */
  allCurrencyTxns: Txn[];
  currency: string;
  group: "statement" | "month";
  budgets: Record<string, number>;
  categoryNames: string[];
}) {
  const [filter, setFilter] = useState<Set<string> | null>(null);
  // The category clicked/drilled in the bar or pie chart — narrows Spending
  // pace to that category (overriding the broader chip filter while active).
  const [activeDrill, setActiveDrill] = useState<string[] | null>(null);

  const visibleCategories = useMemo(
    () => (filter ? rankedCategories.filter((c) => filter.has(c)) : null),
    [filter, rankedCategories],
  );
  const paceCategories = activeDrill ?? visibleCategories;
  const paceBudgetTotal = useMemo(() => {
    const cats = paceCategories ?? rankedCategories;
    const sum = cats.reduce((s, c) => s + (budgets[c] ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }, [paceCategories, rankedCategories, budgets]);

  const filterNote = visibleCategories
    ? ` — filtered to ${visibleCategories.join(", ")}`
    : "";
  const paceNote = activeDrill
    ? ` — showing ${activeDrill.join(", ")} (clicked in the chart)`
    : filterNote;
  const periodNoun = group === "statement" ? "statement" : "month";

  return (
    <>
      <DashboardInteractive
        periods={periods}
        rankedCategories={rankedCategories}
        txns={txns}
        currency={currency}
        group={group}
        budgets={budgets}
        filter={filter}
        onFilterChange={setFilter}
        onActiveCategoryChange={setActiveDrill}
      />

      {periods.length > 0 && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            Spending pace
            {paceNote && (
              <span className="ml-1 font-normal text-zinc-400">{paceNote}</span>
            )}
          </h2>
          <PaceExplorer
            statementPeriods={statementPeriods}
            monthPeriods={monthPeriods}
            txns={allCurrencyTxns}
            currency={currency}
            defaultLevel={group}
            budgetTotal={paceBudgetTotal > 0 ? paceBudgetTotal : null}
            visibleCategories={paceCategories}
          />
        </section>
      )}

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Top merchant
          {filterNote && (
            <span className="ml-1 font-normal text-zinc-400">{filterNote}</span>
          )}
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          The single biggest merchant (net of refunds) inside each {periodNoun}{" "}
          and each category — click a bar to see the transactions behind it
        </p>
        <TopMerchantViz
          periods={periods}
          periodNoun={periodNoun}
          currency={currency}
          txns={txns}
          categories={categoryNames}
          group={group}
          visibleCategories={visibleCategories}
        />
      </section>
    </>
  );
}
