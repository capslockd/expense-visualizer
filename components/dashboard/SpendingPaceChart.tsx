"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

/**
 * Spending pace: cumulative net spend through the current period vs the
 * previous one, aligned by day-of-period — answers "am I spending faster
 * than last cycle?" Emphasis form: current in accent, previous in gray.
 */
export default function SpendingPaceChart({
  current,
  previous,
  currentLabel,
  previousLabel,
  currency,
}: {
  current: Array<{ day: number; cum: number }>;
  previous: Array<{ day: number; cum: number }>;
  currentLabel: string;
  previousLabel: string | null;
  currency: string;
}) {
  if (current.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No spending in the latest period yet.
      </p>
    );
  }

  // Merge the two series onto one day axis.
  const maxDay = Math.max(
    current[current.length - 1]?.day ?? 0,
    previous[previous.length - 1]?.day ?? 0,
  );
  const currentByDay = new Map(current.map((p) => [p.day, p.cum]));
  const previousByDay = new Map(previous.map((p) => [p.day, p.cum]));
  const rows: Array<{ day: number; current?: number; previous?: number }> = [];
  let lastCur: number | undefined;
  let lastPrev: number | undefined;
  const lastCurrentDay = current[current.length - 1]?.day ?? 0;
  for (let day = 1; day <= maxDay; day++) {
    if (currentByDay.has(day)) lastCur = currentByDay.get(day);
    if (previousByDay.has(day)) lastPrev = previousByDay.get(day);
    rows.push({
      day,
      // step-carry so lines don't dip to zero between spend days;
      // current stops at its last real day (the cycle is still running)
      current: day <= lastCurrentDay ? lastCur : undefined,
      previous: lastPrev,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
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
            const cur = payload.find((p) => p.dataKey === "current");
            const prev = payload.find((p) => p.dataKey === "previous");
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">Day {String(label)} of cycle</p>
                {cur?.value !== undefined && (
                  <p className="flex items-center gap-1.5 text-zinc-700">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: chart.accent }} />
                    {currentLabel}:{" "}
                    <span className="tabular-nums font-medium">
                      {formatMoney(Number(cur.value), currency)}
                    </span>
                  </p>
                )}
                {prev?.value !== undefined && previousLabel && (
                  <p className="flex items-center gap-1.5 text-zinc-500">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: chart.deemphasis }} />
                    {previousLabel}:{" "}
                    <span className="tabular-nums">
                      {formatMoney(Number(prev.value), currency)}
                    </span>
                  </p>
                )}
              </div>
            );
          }}
        />
        {previousLabel && (
          <Line
            type="monotone"
            dataKey="previous"
            name={previousLabel}
            stroke={chart.deemphasis}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
        <Line
          type="monotone"
          dataKey="current"
          name={currentLabel}
          stroke={chart.accent}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
