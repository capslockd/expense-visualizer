"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Txn } from "@/lib/types";
import {
  Period,
  formatMoney,
  isExpenseCategory,
  netByCategory,
  txnInPeriod,
} from "@/lib/analytics";
import { chart, assignSlots } from "./chartTheme";

const OTHER = "Other categories";

/**
 * Blurred-popup drill-down for one statement: a category pie on the left,
 * the selected slice's transactions on the right. Close (button, Escape,
 * or backdrop) returns to the main bar chart.
 */
export default function StatementPieModal({
  period,
  txns,
  rankedCategories,
  currency,
  group,
  onClose,
}: {
  period: Period;
  txns: Txn[];
  rankedCategories: string[];
  currency: string;
  group: "statement" | "month";
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const periodTxns = useMemo(
    () => txns.filter((t) => txnInPeriod(t, group, period.key)),
    [txns, group, period.key],
  );

  const slots = useMemo(() => assignSlots(rankedCategories), [rankedCategories]);

  // Slices: every category with positive net renders individually; only
  // categories beyond the 16 color slots fold into gray (rare guard).
  const slices = useMemo(() => {
    const breakdown = netByCategory(periodTxns).filter((c) => c.total > 0);
    const total = breakdown.reduce((s, c) => s + c.total, 0);
    const main: Array<{ name: string; value: number; color: string; pct: number }> = [];
    let other = 0;
    for (const c of breakdown) {
      const color = slots.get(c.category);
      if (color) {
        main.push({ name: c.category, value: c.total, color, pct: c.total / total });
      } else {
        other += c.total;
      }
    }
    if (other > 0) {
      main.push({
        name: OTHER,
        value: Math.round(other * 100) / 100,
        color: chart.fold,
        pct: other / total,
      });
    }
    return { items: main, total: Math.round(total * 100) / 100 };
  }, [periodTxns, slots]);

  const sliceTxns = useMemo(() => {
    if (!selected) return [];
    return periodTxns
      .filter((t) =>
        selected === OTHER
          ? isExpenseCategory(t.category) &&
            !slices.items.some((s) => s.name === t.category)
          : t.category === selected,
      )
      .filter((t) => isExpenseCategory(t.category))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, periodTxns, slices.items]);

  const sliceNet = useMemo(
    () =>
      Math.round(
        sliceTxns.reduce(
          (s, t) => s + (t.direction === "debit" ? t.amount : -t.amount),
          0,
        ) * 100,
      ) / 100,
    [sliceTxns],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Category breakdown for ${period.label}`}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{period.label}</h2>
            <p className="text-xs text-zinc-500">
              {formatMoney(slices.total, currency)} net spend · click a slice to
              see its transactions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            ← Back to chart
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-5 md:grid-cols-2">
          {/* Pie */}
          <div className="flex min-h-[300px] flex-col">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof slices.items)[number];
                    return (
                      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium text-zinc-900">{p.name}</p>
                        <p className="tabular-nums text-zinc-700">
                          {formatMoney(p.value, currency)} ·{" "}
                          {(p.pct * 100).toFixed(1)}%
                        </p>
                      </div>
                    );
                  }}
                />
                <Pie
                  data={slices.items}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={105}
                  paddingAngle={1}
                  stroke={chart.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(entry) => {
                    const name = (entry as { name?: string })?.name;
                    if (name) setSelected((prev) => (prev === name ? null : name));
                  }}
                  label={(props) => {
                    const { name, percent } = props as { name?: string; percent?: number };
                    return (percent ?? 0) >= 0.06 ? `${name} ${(percent! * 100).toFixed(0)}%` : "";
                  }}
                  labelLine={false}
                >
                  {slices.items.map((s) => (
                    <Cell
                      key={s.name}
                      fill={s.color}
                      fillOpacity={selected && selected !== s.name ? 0.35 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Legend doubles as slice selector */}
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {slices.items.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelected((prev) => (prev === s.name ? null : s.name))}
                  className={`flex items-center gap-1.5 text-xs ${
                    selected === s.name
                      ? "font-semibold text-zinc-900 underline"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Slice transactions */}
          <div className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/60">
            {selected ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">{selected}</p>
                  <p className="text-xs text-zinc-500">
                    {sliceTxns.length} transaction{sliceTxns.length === 1 ? "" : "s"} · net{" "}
                    {sliceNet < 0 ? "−" : ""}
                    {formatMoney(Math.abs(sliceNet), currency)}
                  </p>
                </div>
                <ul className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto px-4">
                  {sliceTxns.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {t.merchant}
                        </p>
                        <p className="text-xs text-zinc-500">{t.date}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap text-sm tabular-nums ${
                          t.direction === "credit" ? "text-emerald-700" : "text-zinc-900"
                        }`}
                      >
                        {t.direction === "credit" ? "+" : ""}
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
                Select a slice of the pie to list its transactions here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
