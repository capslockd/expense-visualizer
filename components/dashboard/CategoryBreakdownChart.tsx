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

/**
 * "Which category was most expensive?" — emphasis form: the top category in
 * the accent hue, the rest recessive gray, every bar direct-labeled.
 */
export default function CategoryBreakdownChart({
  data,
  currency,
}: {
  data: Array<{ category: string; total: number }>;
  currency: string;
}) {
  const rows = data.filter((d) => d.total > 0);
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No expenses in this period.</p>;
  }
  const height = Math.max(rows.length * 36 + 16, 120);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 76, bottom: 0, left: 8 }}
        barSize={18}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="category"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fill: chart.inkSecondary, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { category: string; total: number };
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{p.category}</p>
                <p className="text-zinc-600">{formatMoney(p.total, currency)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((row, i) => (
            <Cell
              key={row.category}
              fill={i === 0 ? chart.accent : chart.deemphasis}
            />
          ))}
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v) => formatMoney(Number(v), currency)}
            style={{ fill: chart.inkSecondary, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
