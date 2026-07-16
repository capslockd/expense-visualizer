"use client";

import { useState } from "react";
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
import { formatMoney } from "@/lib/analytics";

export interface TopMerchantRow {
  label: string; // statement period or category name
  merchant: string;
  total: number; // net of refunds
}

function TopMerchantBars({
  rows,
  currency,
  emptyText,
}: {
  rows: TopMerchantRow[];
  currency: string;
  emptyText: string;
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
            const r = payload[0].payload as TopMerchantRow;
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{r.label}</p>
                <p className="text-zinc-600">
                  Top merchant: <span className="font-medium">{r.merchant}</span>
                </p>
                <p className="tabular-nums text-zinc-900">
                  {formatMoney(r.total, currency)} net
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.label} fill={chart.accent} />
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
 * each statement period, and within each category.
 */
export default function TopMerchantViz({
  perPeriod,
  perCategory,
  periodNoun,
  currency,
}: {
  perPeriod: TopMerchantRow[];
  perCategory: TopMerchantRow[];
  periodNoun: "statement" | "month";
  currency: string;
}) {
  const [view, setView] = useState<"period" | "category">("period");
  return (
    <div>
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm w-fit">
        {(
          [
            ["period", `Per ${periodNoun}`],
            ["category", "Per category"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
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
        />
      ) : (
        <TopMerchantBars
          rows={perCategory}
          currency={currency}
          emptyText="No categorized expenses yet."
        />
      )}
    </div>
  );
}
