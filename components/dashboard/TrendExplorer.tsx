"use client";

import { useMemo, useState } from "react";
import { Txn } from "@/lib/types";
import {
  Period,
  formatMoney,
  isExpenseCategory,
  txnInPeriod,
} from "@/lib/analytics";
import { chart, assignSlots } from "./chartTheme";
import TrendChart, { OTHER_KEY } from "./TrendChart";
import CategoryOrdersChart from "./CategoryOrdersChart";

/**
 * Trend chart + drill-down. Clicking a legend entry (or a bar segment) shows
 * that category's individual orders — one bar per transaction, scoped to a
 * single statement/month via the period picker, so nothing is aggregated.
 */
export default function TrendExplorer({
  periods,
  rankedCategories,
  txns,
  currency,
  group,
}: {
  periods: Period[];
  rankedCategories: string[];
  txns: Txn[];
  currency: string;
  group: "statement" | "month";
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // null = all periods; otherwise a period key from the picker.
  const [periodKey, setPeriodKey] = useState<string | null>(null);

  const slots = useMemo(() => assignSlots(rankedCategories), [rankedCategories]);
  const topSet = useMemo(
    () => new Set(rankedCategories.slice(0, chart.slots.length)),
    [rankedCategories],
  );

  function handleSelect(category: string, clickedPeriodKey?: string) {
    setSelected((prev) => {
      if (prev === category && !clickedPeriodKey) return null;
      return category;
    });
    // Segment clicks scope to their period; legend clicks default to the latest.
    setPeriodKey(clickedPeriodKey ?? periods[periods.length - 1]?.key ?? null);
  }

  const drillTxns = useMemo(() => {
    if (!selected) return [];
    return txns
      .filter((t) => {
        const inCategory =
          selected === OTHER_KEY
            ? isExpenseCategory(t.category) && !topSet.has(t.category)
            : t.category === selected;
        if (!inCategory) return false;
        if (periodKey === null) return true;
        return txnInPeriod(t, group, periodKey);
      })
      .filter((t) => isExpenseCategory(t.category));
  }, [selected, periodKey, txns, topSet, group]);

  const drillStats = useMemo(() => {
    let net = 0;
    let orders = 0;
    let refunds = 0;
    for (const t of drillTxns) {
      net += t.direction === "debit" ? t.amount : -t.amount;
      if (t.direction === "debit") orders += 1;
      else refunds += 1;
    }
    return { net: Math.round(net * 100) / 100, orders, refunds };
  }, [drillTxns]);

  const color = selected
    ? selected === OTHER_KEY
      ? chart.fold
      : (slots.get(selected) ?? chart.fold)
    : chart.fold;

  const periodNoun = group === "statement" ? "statement" : "month";

  return (
    <div>
      <TrendChart
        periods={periods}
        rankedCategories={rankedCategories}
        currency={currency}
        selectedCategory={selected}
        onSelectCategory={handleSelect}
      />

      {selected && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: color }}
                />
                {selected} — every order, no aggregation
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {drillStats.orders} order{drillStats.orders === 1 ? "" : "s"}
                {drillStats.refunds > 0 &&
                  `, ${drillStats.refunds} refund${drillStats.refunds === 1 ? "" : "s"}`}{" "}
                · net {drillStats.net < 0 ? "−" : ""}
                {formatMoney(Math.abs(drillStats.net), currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Close ✕
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-zinc-500">Show {periodNoun}:</span>
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  periodKey === p.key
                    ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPeriodKey(null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                periodKey === null
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              All {periodNoun}s
            </button>
          </div>

          <CategoryOrdersChart txns={drillTxns} currency={currency} color={color} />
        </div>
      )}
    </div>
  );
}
