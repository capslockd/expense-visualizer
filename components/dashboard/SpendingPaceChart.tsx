"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

export interface PaceSeries {
  key: string;
  label: string;
  points: Array<{ day: number; cum: number }>;
  /** accent = the focused cycle; muted = comparison cycles; average = dashed benchmark. */
  variant: "accent" | "muted" | "average";
}

/**
 * Cumulative spend lines aligned by day-of-cycle. Each series stops at its
 * own last spend day (an unfinished cycle simply ends earlier). Emphasis
 * form: one accent line, recessive gray comparisons, dashed average.
 */
export default function SpendingPaceChart({
  series,
  currency,
  budgetTotal,
  emptyText = "No spending in the selected scope yet.",
}: {
  series: PaceSeries[];
  currency: string;
  /** Aggregate per-cycle budget — drawn as a red target line. */
  budgetTotal?: number | null;
  emptyText?: string;
}) {
  const drawable = series.filter((s) => s.points.length > 0);
  if (drawable.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">{emptyText}</p>
    );
  }

  const maxDay = Math.max(...drawable.map((s) => s.points[s.points.length - 1].day));

  // One row per day; each series carries its value forward until its own end.
  const rows: Array<Record<string, number | undefined>> = [];
  const lastValue = new Map<string, number>();
  const lastDay = new Map(
    drawable.map((s) => [s.key, s.points[s.points.length - 1].day]),
  );
  const pointsByDay = new Map(
    drawable.map((s) => [s.key, new Map(s.points.map((p) => [p.day, p.cum]))]),
  );
  for (let day = 1; day <= maxDay; day++) {
    const row: Record<string, number | undefined> = { day };
    for (const s of drawable) {
      const hit = pointsByDay.get(s.key)?.get(day);
      if (hit !== undefined) lastValue.set(s.key, hit);
      row[s.key] =
        day <= (lastDay.get(s.key) ?? 0) ? lastValue.get(s.key) : undefined;
    }
    rows.push(row);
  }

  const styleOf = (variant: PaceSeries["variant"]) => {
    switch (variant) {
      case "accent":
        return { stroke: chart.accent, strokeWidth: 2.5, strokeDasharray: undefined };
      case "average":
        return { stroke: chart.inkSecondary, strokeWidth: 2, strokeDasharray: "6 4" };
      default:
        return { stroke: chart.deemphasis, strokeWidth: 1.5, strokeDasharray: undefined };
    }
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={{ stroke: chart.baseline }}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
          tickFormatter={(d) => `Day ${d}`}
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
          cursor={{ stroke: chart.baseline, strokeDasharray: "3 3" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const items = payload
              .filter((p) => p.value !== undefined && p.value !== null)
              .map((p) => {
                const s = drawable.find((x) => x.key === String(p.dataKey));
                return s
                  ? { label: s.label, value: Number(p.value), variant: s.variant }
                  : null;
              })
              .filter((x): x is NonNullable<typeof x> => x !== null)
              .sort((a, b) => b.value - a.value);
            return (
              <div className="min-w-44 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">Day {String(label)} of cycle</p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((it) => (
                    <li key={it.label} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-zinc-600">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: styleOf(it.variant).stroke }}
                        />
                        {it.label}
                      </span>
                      <span
                        className={`tabular-nums ${it.variant === "accent" ? "font-medium text-zinc-900" : "text-zinc-600"}`}
                      >
                        {formatMoney(it.value, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }}
        />
        {budgetTotal != null && budgetTotal > 0 && (
          <ReferenceLine
            y={budgetTotal}
            stroke="#d03b3b"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Budget ${formatMoney(budgetTotal, currency)}`,
              position: "insideTopRight",
              fill: "#d03b3b",
              fontSize: 10,
            }}
          />
        )}
        {/* Muted lines first so the accent draws on top. */}
        {[...drawable]
          .sort((a, b) => (a.variant === "accent" ? 1 : 0) - (b.variant === "accent" ? 1 : 0))
          .map((s) => {
            const style = styleOf(s.variant);
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
      </LineChart>
    </ResponsiveContainer>
  );
}
