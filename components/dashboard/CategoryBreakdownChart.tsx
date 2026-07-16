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
 * Click a bar to drill into that category's transactions; the selected bar
 * takes the accent.
 */
export default function CategoryBreakdownChart({
  data,
  currency,
  selectedCategory,
  onSelectCategory,
}: {
  data: Array<{ category: string; total: number }>;
  currency: string;
  selectedCategory?: string | null;
  onSelectCategory?: (category: string) => void;
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
                <p className="text-zinc-600">{formatMoney(p.total, currency)} net of refunds</p>
                {onSelectCategory && (
                  <p className="mt-0.5 text-[10px] text-zinc-400">Click to see transactions</p>
                )}
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          cursor={onSelectCategory ? "pointer" : undefined}
          onClick={(entry) => {
            const cat = (entry as { category?: string })?.category;
            if (cat && onSelectCategory) onSelectCategory(cat);
          }}
        >
          {rows.map((row, i) => {
            const isSelected = selectedCategory === row.category;
            const fill = selectedCategory
              ? isSelected
                ? chart.accent
                : chart.deemphasis
              : i === 0
                ? chart.accent
                : chart.deemphasis;
            return <Cell key={row.category} fill={fill} />;
          })}
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
