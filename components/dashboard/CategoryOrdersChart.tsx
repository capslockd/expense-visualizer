"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";
import { Txn } from "@/lib/types";

const MAX_ROWS = 20;

/**
 * Category drill-down: each ORDER is its own bar — nothing is aggregated, so
 * every value is the exact amount of one transaction in the selected
 * statement/month. Refunds render as green bars to the left of zero.
 */
export default function CategoryOrdersChart({
  txns,
  currency,
  color,
}: {
  txns: Txn[];
  currency: string;
  color: string;
}) {
  const rows = [...txns]
    .map((t) => ({
      id: t.id,
      merchant: t.merchant,
      date: t.date,
      value: t.direction === "debit" ? t.amount : -t.amount,
      direction: t.direction,
      label: `${t.merchant} · ${t.date.slice(5)}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_ROWS);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No transactions in this category for the selected period.
      </p>
    );
  }
  const height = Math.max(rows.length * 32 + 16, 100);
  const hidden = txns.length - rows.length;
  const hasCredit = rows.some((r) => r.value < 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 96, bottom: 0, left: 8 }}
          barSize={15}
        >
          <XAxis type="number" hide domain={["dataMin", "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={170}
            tickLine={false}
            axisLine={false}
            tick={{ fill: chart.inkSecondary, fontSize: 11 }}
            tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)}
          />
          {hasCredit && <ReferenceLine x={0} stroke={chart.baseline} />}
          <Tooltip
            cursor={{ fill: "rgba(11,11,11,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-zinc-900">{r.merchant}</p>
                  <p className="text-zinc-600">{r.date}</p>
                  <p
                    className={`tabular-nums ${r.direction === "credit" ? "text-emerald-700" : "text-zinc-900"}`}
                  >
                    {r.direction === "credit" ? "refund −" : ""}
                    {formatMoney(Math.abs(r.value), currency)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.id} fill={r.direction === "credit" ? "#0ca30c" : color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => {
                const n = Number(v);
                return `${n < 0 ? "−" : ""}${formatMoney(Math.abs(n), currency)}`;
              }}
              style={{ fill: chart.inkSecondary, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hidden > 0 && (
        <p className="mt-1 text-xs text-zinc-400">
          + {hidden} smaller transaction{hidden === 1 ? "" : "s"} not shown
        </p>
      )}
    </div>
  );
}
