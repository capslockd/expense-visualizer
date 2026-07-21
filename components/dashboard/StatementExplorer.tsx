"use client";

import { useMemo, useState } from "react";
import { CategoryType, Txn } from "@/lib/types";
import { formatMoney } from "@/lib/analytics";
import CategoryBreakdownChart from "./CategoryBreakdownChart";
import EditableTxnTable from "./EditableTxnTable";

/**
 * Statement-page category breakdown with drill-down: click a category bar to
 * list every transaction in that category (refund credits shown in green and
 * already deducted from the chart's net figures).
 */
export default function StatementExplorer({
  breakdown,
  txns,
  currency,
  categories,
}: {
  breakdown: Array<{ category: string; total: number }>;
  txns: Txn[];
  currency: string;
  categories: { name: string; type: CategoryType }[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const drillTxns = useMemo(() => {
    if (!selected) return [];
    return txns
      .filter((t) => t.category === selected)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, txns]);

  const stats = useMemo(() => {
    if (!selected) return null;
    let net = 0;
    let orders = 0;
    let refunds = 0;
    for (const t of drillTxns) {
      net += t.direction === "debit" ? t.amount : -t.amount;
      if (t.direction === "debit") orders += 1;
      else refunds += 1;
    }
    return { net: Math.round(net * 100) / 100, orders, refunds };
  }, [selected, drillTxns]);

  return (
    <div>
      <CategoryBreakdownChart
        data={breakdown}
        currency={currency}
        selectedCategory={selected}
        onSelectCategory={(c) => setSelected((prev) => (prev === c ? null : c))}
      />

      {selected && stats && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {selected} — {drillTxns.length} transaction
                {drillTxns.length === 1 ? "" : "s"}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {stats.orders} charge{stats.orders === 1 ? "" : "s"}
                {stats.refunds > 0 &&
                  `, ${stats.refunds} refund${stats.refunds === 1 ? "" : "s"} deducted`}{" "}
                · net {stats.net < 0 ? "−" : ""}
                {formatMoney(Math.abs(stats.net), currency)}
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
          <div className="rounded-lg border border-zinc-200 bg-white p-2">
            <EditableTxnTable txns={drillTxns} categories={categories} />
          </div>
        </div>
      )}
    </div>
  );
}
