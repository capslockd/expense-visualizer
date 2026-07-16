"use client";

import { useMemo, useState } from "react";
import { Txn } from "@/lib/types";
import {
  Period,
  formatMoney,
  isExpenseCategory,
  merchantsInCategory,
} from "@/lib/analytics";
import { chart, assignSlots } from "./chartTheme";
import TrendChart, { OTHER_KEY } from "./TrendChart";
import CategoryMerchantChart from "./CategoryMerchantChart";

/**
 * Trend chart + legend drill-down. Clicking a legend entry (or bar segment)
 * breaks the category down by merchant, with repeat orders aggregated per
 * merchant and refunds netted off.
 */
export default function TrendExplorer({
  periods,
  rankedCategories,
  txns,
  currency,
}: {
  periods: Period[];
  rankedCategories: string[];
  txns: Txn[];
  currency: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const slots = useMemo(() => assignSlots(rankedCategories), [rankedCategories]);
  const topSet = useMemo(
    () => new Set(rankedCategories.slice(0, chart.slots.length)),
    [rankedCategories],
  );

  const drill = useMemo(() => {
    if (!selected) return null;
    if (selected === OTHER_KEY) {
      // The fold: merchants across every expense category outside the top slots.
      const foldTxns = txns.filter(
        (t) => isExpenseCategory(t.category) && !topSet.has(t.category),
      );
      const byMerchant = new Map<
        string,
        { total: number; orders: number; refunds: number }
      >();
      for (const t of foldTxns) {
        const cur = byMerchant.get(t.merchant) ?? { total: 0, orders: 0, refunds: 0 };
        cur.total += t.direction === "debit" ? t.amount : -t.amount;
        if (t.direction === "debit") cur.orders += 1;
        else cur.refunds += 1;
        byMerchant.set(t.merchant, cur);
      }
      return [...byMerchant.entries()]
        .map(([merchant, v]) => ({
          merchant,
          ...v,
          total: Math.round(v.total * 100) / 100,
        }))
        .sort((a, b) => b.total - a.total);
    }
    return merchantsInCategory(txns, selected);
  }, [selected, txns, topSet]);

  const drillStats = useMemo(() => {
    if (!drill) return null;
    const net = Math.round(drill.reduce((s, m) => s + m.total, 0) * 100) / 100;
    const orders = drill.reduce((s, m) => s + m.orders, 0);
    const refunds = drill.reduce((s, m) => s + m.refunds, 0);
    return { net, orders, refunds };
  }, [drill]);

  const color = selected
    ? selected === OTHER_KEY
      ? chart.fold
      : (slots.get(selected) ?? chart.fold)
    : chart.fold;

  return (
    <div>
      <TrendChart
        periods={periods}
        rankedCategories={rankedCategories}
        currency={currency}
        selectedCategory={selected}
        onSelectCategory={(c) => setSelected((prev) => (prev === c ? null : c))}
      />

      {selected && drill && drillStats && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: color }}
                />
                {selected} — by merchant
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {drillStats.orders} order{drillStats.orders === 1 ? "" : "s"} across{" "}
                {drill.length} merchant{drill.length === 1 ? "" : "s"}
                {drillStats.refunds > 0 &&
                  `, ${drillStats.refunds} refund${drillStats.refunds === 1 ? "" : "s"} deducted`}{" "}
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
          <CategoryMerchantChart merchants={drill} currency={currency} color={color} />
        </div>
      )}
    </div>
  );
}
