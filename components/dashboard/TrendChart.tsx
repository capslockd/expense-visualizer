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
import { Period, formatMoney } from "@/lib/analytics";

export const OTHER_KEY = "Other categories";

/**
 * Stacked columns per period (statement or month). Top categories get fixed
 * categorical slots; the small remainder folds into a gray rollup. Click a
 * legend entry or bar segment to drill into that category's merchants.
 *
 * Bars stack the POSITIVE part of each category's net (a stack can't render
 * a negative segment); the tooltip always reports the ACTUAL net, so a
 * refund-heavy category shows e.g. −$12.50 even though its segment is 0px.
 */
export default function TrendChart({
  periods,
  rankedCategories,
  currency,
  selectedCategory,
  onSelectCategory,
}: {
  periods: Period[];
  rankedCategories: string[];
  currency: string;
  selectedCategory: string | null;
  onSelectCategory: (category: string, periodKey?: string) => void;
}) {
  if (periods.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Upload a statement to see trends.
      </p>
    );
  }

  const slots = assignSlots(rankedCategories);
  const topCategories = rankedCategories.slice(0, chart.slots.length);
  const hasFold = rankedCategories.length > topCategories.length;

  const rows = periods.map((p) => {
    const row: Record<string, unknown> = {
      label: p.label,
      __key: p.key,
      __total: p.total,
      __actual: p.byCategory,
    };
    let other = 0;
    let otherActual = 0;
    for (const [cat, net] of Object.entries(p.byCategory)) {
      if (slots.has(cat)) {
        row[cat] = Math.max(net, 0);
      } else {
        other += Math.max(net, 0);
        otherActual += net;
      }
    }
    if (hasFold) {
      row[OTHER_KEY] = Math.round(other * 100) / 100;
      (row.__actual as Record<string, number>) = {
        ...p.byCategory,
        [OTHER_KEY]: Math.round(otherActual * 100) / 100,
      };
    }
    return row;
  });

  const seriesKeys = hasFold ? [...topCategories, OTHER_KEY] : topCategories;
  const colorOf = (key: string) =>
    key === OTHER_KEY ? chart.fold : (slots.get(key) ?? chart.fold);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: chart.baseline }}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
          interval="preserveStartEnd"
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
            const row = payload[0]?.payload as {
              __total?: number;
              __actual?: Record<string, number>;
            };
            const actual = row.__actual ?? {};
            const items = payload
              .map((p) => ({
                key: String(p.dataKey),
                color: String(p.color),
                net: actual[String(p.dataKey)] ?? Number(p.value),
              }))
              .filter((p) => p.net !== 0)
              .sort((a, b) => b.net - a.net);
            return (
              <div className="min-w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">
                  {label} · {formatMoney(row.__total ?? 0, currency)}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((p) => (
                    <li key={p.key} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-zinc-600">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: p.color }}
                        />
                        {p.key}
                      </span>
                      <span
                        className={`tabular-nums ${p.net < 0 ? "text-emerald-700" : "text-zinc-900"}`}
                      >
                        {p.net < 0 ? "−" : ""}
                        {formatMoney(Math.abs(p.net), currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 border-t border-zinc-100 pt-1 text-[10px] text-zinc-400">
                  Net of refunds · click a legend entry to drill in
                </p>
              </div>
            );
          }}
        />
        <Legend
          iconType="square"
          iconSize={9}
          onClick={(entry) => {
            const key = String(
              (entry as { dataKey?: unknown; value?: unknown }).dataKey ??
                (entry as { value?: unknown }).value ??
                "",
            );
            if (key) onSelectCategory(key);
          }}
          wrapperStyle={{
            fontSize: 12,
            color: chart.inkSecondary,
            paddingTop: 8,
            cursor: "pointer",
          }}
          formatter={(value) => (
            <span
              style={{
                fontWeight: value === selectedCategory ? 700 : 400,
                textDecoration: value === selectedCategory ? "underline" : "none",
                color: chart.inkSecondary,
              }}
            >
              {String(value)}
            </span>
          )}
        />
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="spend"
            fill={colorOf(key)}
            fillOpacity={selectedCategory && selectedCategory !== key ? 0.35 : 1}
            stroke={chart.surface}
            strokeWidth={1.5}
            radius={i === seriesKeys.length - 1 ? [3, 3, 0, 0] : undefined}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(data) => {
              const d = data as { payload?: { __key?: string }; __key?: string };
              onSelectCategory(key, d?.payload?.__key ?? d?.__key);
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
