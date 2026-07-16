"use client";

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

const MAX_ROWS = 15;

/**
 * Merchant breakdown for one category — the legend drill-down. Each bar is a
 * merchant's NET spend (refunds deducted); the ×N label counts repeat orders.
 */
export default function CategoryMerchantChart({
  merchants,
  currency,
  color,
}: {
  merchants: Array<{ merchant: string; total: number; orders: number; refunds: number }>;
  currency: string;
  color: string;
}) {
  const rows = merchants.slice(0, MAX_ROWS).map((m) => ({
    ...m,
    bar: Math.max(m.total, 0), // a fully-refunded merchant renders at 0 width
  }));
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No transactions in this category for the selected data.
      </p>
    );
  }
  const height = Math.max(rows.length * 34 + 16, 100);
  const hidden = merchants.length - rows.length;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 110, bottom: 0, left: 8 }}
          barSize={16}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="merchant"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: chart.inkSecondary, fontSize: 12 }}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(11,11,11,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const m = payload[0].payload as (typeof rows)[number];
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-zinc-900">{m.merchant}</p>
                  <p className="text-zinc-600">
                    {m.orders} order{m.orders === 1 ? "" : "s"}
                    {m.refunds > 0 &&
                      ` · ${m.refunds} refund${m.refunds === 1 ? "" : "s"} deducted`}
                  </p>
                  <p
                    className={`tabular-nums ${m.total < 0 ? "text-emerald-700" : "text-zinc-900"}`}
                  >
                    net {m.total < 0 ? "−" : ""}
                    {formatMoney(Math.abs(m.total), currency)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="bar" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((m) => (
              <Cell key={m.merchant} fill={color} />
            ))}
            <LabelList
              dataKey="merchant"
              content={(props) => {
                const { x, y, width, height: h, index } = props as {
                  x: number; y: number; width: number; height: number; index: number;
                };
                const m = rows[index];
                if (!m) return null;
                return (
                  <text
                    x={x + width + 6}
                    y={y + h / 2}
                    dominantBaseline="central"
                    style={{ fill: chart.inkSecondary, fontSize: 11 }}
                  >
                    {m.total < 0 ? "−" : ""}
                    {formatMoney(Math.abs(m.total), currency)}
                    {m.orders > 1 ? ` ×${m.orders}` : ""}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hidden > 0 && (
        <p className="mt-1 text-xs text-zinc-400">
          + {hidden} smaller merchant{hidden === 1 ? "" : "s"} not shown
        </p>
      )}
    </div>
  );
}
