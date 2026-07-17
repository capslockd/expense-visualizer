"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chart, assignSlots } from "./chartTheme";
import { Period, formatMoney } from "@/lib/analytics";
import { OTHER_KEY } from "./TrendChart";

/**
 * Pie view of the Spend-by-category card: category shares aggregated across
 * the visible periods (narrow the window to 1 or 3 for a single-cycle pie).
 * Clicking a slice opens the same per-order drill-down as the bar chart.
 */
export default function CategoryPie({
  periods,
  rankedCategories,
  visibleCategories,
  currency,
  selectedCategory,
  onSelectCategory,
  budgetTotal,
}: {
  periods: Period[];
  rankedCategories: string[];
  visibleCategories: string[] | null;
  currency: string;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  budgetTotal?: number | null;
}) {
  const slots = useMemo(() => assignSlots(rankedCategories), [rankedCategories]);

  const slices = useMemo(() => {
    const visible = visibleCategories ? new Set(visibleCategories) : null;
    const nets = new Map<string, number>();
    for (const p of periods) {
      for (const [cat, net] of Object.entries(p.byCategory)) {
        if (visible && !visible.has(cat)) continue;
        nets.set(cat, (nets.get(cat) ?? 0) + net);
      }
    }
    const positive = [...nets.entries()]
      .map(([name, v]) => ({ name, value: Math.round(v * 100) / 100 }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = positive.reduce((s, c) => s + c.value, 0);

    const main: Array<{ name: string; value: number; color: string; pct: number }> = [];
    let other = 0;
    for (const c of positive) {
      const color = slots.get(c.name);
      if (color) {
        main.push({ name: c.name, value: c.value, color, pct: c.value / total });
      } else {
        other += c.value;
      }
    }
    if (other > 0) {
      main.push({
        name: OTHER_KEY,
        value: Math.round(other * 100) / 100,
        color: chart.fold,
        pct: other / total,
      });
    }
    return { items: main, total: Math.round(total * 100) / 100 };
  }, [periods, visibleCategories, slots]);

  if (slices.items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No spending in the selected window.
      </p>
    );
  }

  const periodsNote =
    periods.length === 1
      ? periods[0].label
      : `${periods.length} periods (${periods[0].label} → ${periods[periods.length - 1].label})`;

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof slices.items)[number];
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-zinc-900">{p.name}</p>
                  <p className="tabular-nums text-zinc-700">
                    {formatMoney(p.value, currency)} · {(p.pct * 100).toFixed(1)}%
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    Click to drill into orders
                  </p>
                </div>
              );
            }}
          />
          <Pie
            data={slices.items}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={120}
            paddingAngle={1}
            stroke={chart.surface}
            strokeWidth={2}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(entry) => {
              const name = (entry as { name?: string })?.name;
              if (name) onSelectCategory(name);
            }}
            label={(props) => {
              const { name, percent } = props as { name?: string; percent?: number };
              return (percent ?? 0) >= 0.05
                ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                : "";
            }}
            labelLine={false}
          >
            {slices.items.map((s) => (
              <Cell
                key={s.name}
                fill={s.color}
                fillOpacity={selectedCategory && selectedCategory !== s.name ? 0.35 : 1}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-500">
        {formatMoney(slices.total, currency)} net across {periodsNote}
        {budgetTotal != null && budgetTotal > 0 && (
          <>
            {" · "}
            <span
              className={slices.total > budgetTotal * periods.length ? "font-medium text-red-700" : "text-zinc-500"}
            >
              budget {formatMoney(budgetTotal * periods.length, currency)}
              {periods.length > 1 ? ` (${formatMoney(budgetTotal, currency)}/cycle)` : ""}
            </span>
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.items.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onSelectCategory(s.name)}
            className={`flex items-center gap-1.5 text-xs ${
              selectedCategory === s.name
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
  );
}
