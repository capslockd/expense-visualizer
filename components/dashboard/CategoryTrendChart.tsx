"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { Period, formatMoney } from "@/lib/analytics";
import { OTHER_KEY } from "./TrendChart";

/**
 * One category's net spend, one bar per period — puts the clicked category
 * side by side across every visible statement/month so it can be compared
 * against previous periods at a glance. Single series: the category's own
 * slot color carries identity (no legend needed), refund-heavy periods (net
 * < 0) render green to match the credit convention used everywhere else.
 */
export default function CategoryTrendChart({
  periods,
  rankedCategories,
  category,
  currency,
  color,
  periodNoun,
  budget,
  focusPeriodKey,
  onSelectPeriod,
}: {
  periods: Period[];
  rankedCategories: string[];
  category: string;
  currency: string;
  color: string;
  periodNoun: string;
  /** This category's per-cycle budget, if set — drawn as a red line. */
  budget?: number | null;
  /** The period currently focused below (orders list) — its bar renders solid, others dim. */
  focusPeriodKey?: string | null;
  onSelectPeriod?: (periodKey: string) => void;
}) {
  const topSet = new Set(rankedCategories.slice(0, chart.slots.length));

  const rows = periods.map((p) => {
    let value: number;
    if (category === OTHER_KEY) {
      value = Object.entries(p.byCategory)
        .filter(([cat]) => !topSet.has(cat))
        .reduce((s, [, net]) => s + net, 0);
    } else {
      value = p.byCategory[category] ?? 0;
    }
    return { key: p.key, label: p.label, value: Math.round(value * 100) / 100 };
  });

  const hasData = rows.some((r) => r.value !== 0);
  if (!hasData) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No {category} spending in the visible window.
      </p>
    );
  }

  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const delta = prev ? Math.round((last.value - prev.value) * 100) / 100 : null;
  const hasNegative = rows.some((r) => r.value < 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: chart.baseline }}
            interval="preserveStartEnd"
            tick={{ fill: chart.inkMuted, fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: chart.inkMuted, fontSize: 11 }}
            tickFormatter={(v) => formatMoney(Number(v), currency)}
          />
          {hasNegative && <ReferenceLine y={0} stroke={chart.baseline} />}
          {budget != null && budget > 0 && (
            <ReferenceLine
              y={budget}
              stroke={chart.critical}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Budget ${formatMoney(budget, currency)}`,
                position: "insideTopRight",
                fill: chart.critical,
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            cursor={{ fill: "rgba(11,11,11,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              const idx = rows.findIndex((x) => x.key === r.key);
              const p = idx > 0 ? rows[idx - 1] : null;
              const d = p ? Math.round((r.value - p.value) * 100) / 100 : null;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-zinc-900">{r.label}</p>
                  <p
                    className={`tabular-nums ${r.value < 0 ? "text-emerald-700" : "text-zinc-900"}`}
                  >
                    {r.value < 0 ? "−" : ""}
                    {formatMoney(Math.abs(r.value), currency)}
                  </p>
                  {d !== null && (
                    <p
                      className={`tabular-nums ${
                        d > 0 ? "text-red-600" : d < 0 ? "text-emerald-700" : "text-zinc-400"
                      }`}
                    >
                      {d === 0
                        ? "same as previous"
                        : `${d > 0 ? "+" : "−"}${formatMoney(Math.abs(d), currency)} vs previous`}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[3, 3, 3, 3]}
            isAnimationActive={false}
            cursor={onSelectPeriod ? "pointer" : undefined}
            onClick={(data) => {
              const d = data as { payload?: { key?: string } };
              if (d?.payload?.key && onSelectPeriod) onSelectPeriod(d.payload.key);
            }}
          >
            {rows.map((r) => (
              <Cell
                key={r.key}
                fill={r.value < 0 ? "#0ca30c" : color}
                fillOpacity={focusPeriodKey && focusPeriodKey !== r.key ? 0.45 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {prev && delta !== null && (
        <p className="mt-1 text-center text-xs text-zinc-500">
          Latest {periodNoun} ({last.label}): {last.value < 0 ? "−" : ""}
          {formatMoney(Math.abs(last.value), currency)}{" "}
          <span
            className={
              delta > 0 ? "text-red-600" : delta < 0 ? "text-emerald-700" : "text-zinc-400"
            }
          >
            (
            {delta === 0
              ? "no change"
              : `${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta), currency)}`}
            )
          </span>{" "}
          vs previous {periodNoun}
        </p>
      )}
    </div>
  );
}
