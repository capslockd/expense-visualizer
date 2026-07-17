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
import { WEEKDAYS, formatMoney } from "@/lib/analytics";

/**
 * "Which day of the week costs the most?" — Mon-first columns of net spend;
 * the highest day takes the accent, the rest stay recessive.
 */
export default function WeekdayChart({
  data,
  currency,
}: {
  data: Array<{ weekday: (typeof WEEKDAYS)[number]; total: number; count: number }>;
  currency: string;
}) {
  const hasSpend = data.some((d) => d.total > 0);
  if (!hasSpend) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No spending in the selected scope yet.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.total));
  const rows = data.map((d) => ({ ...d, bar: Math.max(d.total, 0) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 8 }} barCategoryGap="24%">
        <XAxis
          dataKey="weekday"
          tickLine={false}
          axisLine={{ stroke: chart.baseline }}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof rows)[number];
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{d.weekday}</p>
                <p className="tabular-nums text-zinc-700">
                  {d.total < 0 ? "−" : ""}
                  {formatMoney(Math.abs(d.total), currency)} net
                </p>
                <p className="text-zinc-500">
                  {d.count} transaction{d.count === 1 ? "" : "s"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="bar" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {rows.map((d) => (
            <Cell
              key={d.weekday}
              fill={d.total === max && max > 0 ? chart.accent : chart.deemphasis}
            />
          ))}
          <LabelList
            dataKey="total"
            position="top"
            formatter={(v) => {
              const n = Number(v);
              return n > 0 ? formatMoney(n, currency) : "";
            }}
            style={{ fill: chart.inkSecondary, fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
