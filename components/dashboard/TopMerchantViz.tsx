"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import {
  Period,
  TopMerchantEntry,
  formatMoney,
  topMerchantPerCategory,
  topMerchantPerPeriod,
  txnInPeriod,
} from "@/lib/analytics";
import { Txn } from "@/lib/types";
import EditableTxnTable from "./EditableTxnTable";

type Selection = { view: "period" | "category"; entry: TopMerchantEntry };

function TopMerchantBars({
  rows,
  currency,
  emptyText,
  selectedKey,
  onSelect,
}: {
  rows: TopMerchantEntry[];
  currency: string;
  emptyText: string;
  selectedKey: string | null;
  onSelect: (row: TopMerchantEntry) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500">{emptyText}</p>;
  }
  const height = Math.max(rows.length * 40 + 16, 100);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 180, bottom: 0, left: 8 }}
        barSize={16}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fill: chart.inkSecondary, fontSize: 12 }}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as TopMerchantEntry;
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{r.label}</p>
                <p className="text-zinc-600">
                  Top merchant: <span className="font-medium">{r.merchant}</span>
                </p>
                <p className="tabular-nums text-zinc-900">
                  {formatMoney(r.total, currency)} net
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  Click to see the transactions
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          cursor="pointer"
          onClick={(data) => {
            const d = data as { payload?: TopMerchantEntry };
            const row = d?.payload ?? (data as unknown as TopMerchantEntry);
            if (row?.key) onSelect(row);
          }}
        >
          {rows.map((r) => (
            <Cell
              key={r.key}
              fill={
                selectedKey === null || selectedKey === r.key
                  ? chart.accent
                  : chart.deemphasis
              }
            />
          ))}
          <LabelList
            content={(props) => {
              const { x, y, width, height: h, index } = props as {
                x: number; y: number; width: number; height: number; index: number;
              };
              const r = rows[index];
              if (!r) return null;
              const name = r.merchant.length > 22 ? `${r.merchant.slice(0, 21)}…` : r.merchant;
              return (
                <text
                  x={x + width + 6}
                  y={y + h / 2}
                  dominantBaseline="central"
                  style={{ fontSize: 11 }}
                >
                  <tspan style={{ fill: chart.ink, fontWeight: 500 }}>{name}</tspan>
                  <tspan style={{ fill: chart.inkMuted }}>
                    {" "}
                    · {formatMoney(r.total, currency)}
                  </tspan>
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * "Where does the most money go?" — the #1 merchant (net of refunds) within
 * each statement/month and each category. Clicking a bar lists every
 * transaction behind it.
 */
export default function TopMerchantViz({
  periods,
  periodNoun,
  currency,
  txns: allTxns,
  categories,
  group,
  visibleCategories,
}: {
  periods: Period[];
  periodNoun: "statement" | "month";
  currency: string;
  txns: Txn[];
  categories: string[];
  group: "statement" | "month";
  /** Category filter from the Spend-by-category card — null = all. */
  visibleCategories: string[] | null;
}) {
  const [view, setView] = useState<"period" | "category">("period");
  const [selection, setSelection] = useState<Selection | null>(null);

  // The whole section follows the category filter, drill included.
  const txns = useMemo(() => {
    if (!visibleCategories) return allTxns;
    const visible = new Set(visibleCategories);
    return allTxns.filter((t) => visible.has(t.category));
  }, [allTxns, visibleCategories]);

  const perPeriod = useMemo(
    () => topMerchantPerPeriod(txns, periods, group),
    [txns, periods, group],
  );
  const perCategory = useMemo(() => topMerchantPerCategory(txns), [txns]);

  const drillTxns = useMemo(() => {
    if (!selection) return [];
    const { view: v, entry } = selection;
    return txns
      .filter((t) => {
        if (t.merchant !== entry.merchant) return false;
        return v === "period"
          ? txnInPeriod(t, group, entry.key)
          : t.category === entry.key;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selection, txns, group]);

  const drillNet = useMemo(
    () =>
      Math.round(
        drillTxns.reduce(
          (s, t) => s + (t.direction === "debit" ? t.amount : -t.amount),
          0,
        ) * 100,
      ) / 100,
    [drillTxns],
  );

  function switchView(v: "period" | "category") {
    setView(v);
    setSelection(null);
  }

  function handleSelect(v: "period" | "category") {
    return (entry: TopMerchantEntry) =>
      setSelection((prev) =>
        prev?.entry.key === entry.key && prev.view === v ? null : { view: v, entry },
      );
  }

  return (
    <div>
      <div className="mb-3 flex w-fit items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm">
        {(
          [
            ["period", `Per ${periodNoun}`],
            ["category", "Per category"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => switchView(v)}
            className={`rounded-md px-3 py-1 ${
              view === v
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "period" ? (
        <TopMerchantBars
          rows={perPeriod}
          currency={currency}
          emptyText={`No ${periodNoun}s with expenses yet.`}
          selectedKey={selection?.view === "period" ? selection.entry.key : null}
          onSelect={handleSelect("period")}
        />
      ) : (
        <TopMerchantBars
          rows={perCategory}
          currency={currency}
          emptyText="No categorized expenses yet."
          selectedKey={selection?.view === "category" ? selection.entry.key : null}
          onSelect={handleSelect("category")}
        />
      )}

      {selection && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {selection.entry.merchant} —{" "}
                {selection.view === "period"
                  ? selection.entry.label
                  : `all ${selection.entry.label} transactions`}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {drillTxns.length} transaction{drillTxns.length === 1 ? "" : "s"} · net{" "}
                {drillNet < 0 ? "−" : ""}
                {formatMoney(Math.abs(drillNet), currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelection(null)}
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
