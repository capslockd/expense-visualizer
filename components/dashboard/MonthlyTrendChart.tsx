"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart, assignSlots } from "./chartTheme";
import { formatMoney, monthLabel } from "@/lib/analytics";

const OTHER_KEY = "Other categories";

/**
 * Stacked monthly columns. Top categories (by all-time spend) get fixed
 * categorical slots; the small remainder folds into a gray "Other categories"
 * rollup (a visual fold — the underlying data is still fully categorized).
 */
export default function MonthlyTrendChart({
  data,
  rankedCategories,
  currency,
}: {
  data: Array<{ month: string; total: number; byCategory: Record<string, number> }>;
  rankedCategories: string[];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">Upload a statement to see trends.</p>;
  }

  const slots = assignSlots(rankedCategories);
  const topCategories = rankedCategories.slice(0, chart.slots.length);
  const hasFold = rankedCategories.length > topCategories.length;

  const rows = data.map((m) => {
    const row: Record<string, number | string> = {
      month: m.month,
      label: monthLabel(m.month),
      __total: m.total,
    };
    let other = 0;
    for (const [cat, net] of Object.entries(m.byCategory)) {
      const clamped = Math.max(net, 0); // stacks can't render negative nets; tooltip shows actuals
      if (slots.has(cat)) row[cat] = clamped;
      else other += clamped;
    }
    if (hasFold) row[OTHER_KEY] = Math.round(other * 100) / 100;
    return row;
  });

  const seriesKeys = hasFold ? [...topCategories, OTHER_KEY] : topCategories;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: chart.baseline }}
          tick={{ fill: chart.inkMuted, fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
          tickFormatter={(v) => formatMoney(Number(v), currency)}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const total = payload[0]?.payload?.__total as number | undefined;
            const items = payload
              .filter((p) => Number(p.value) > 0)
              .sort((a, b) => Number(b.value) - Number(a.value));
            return (
              <div className="min-w-44 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">
                  {label} · {formatMoney(total ?? 0, currency)}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((p) => (
                    <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-zinc-600">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: String(p.color) }}
                        />
                        {String(p.dataKey)}
                      </span>
                      <span className="tabular-nums text-zinc-900">
                        {formatMoney(Number(p.value), currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }}
        />
        <Legend
          iconType="square"
          iconSize={9}
          wrapperStyle={{ fontSize: 12, color: chart.inkSecondary, paddingTop: 8 }}
        />
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="spend"
            fill={key === OTHER_KEY ? chart.fold : (slots.get(key) ?? chart.fold)}
            stroke={chart.surface}
            strokeWidth={1.5}
            radius={i === seriesKeys.length - 1 ? [3, 3, 0, 0] : undefined}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
