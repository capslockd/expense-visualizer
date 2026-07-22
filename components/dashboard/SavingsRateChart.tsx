"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

export interface SavingsRatePoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  /** (income-expense)/income*100 — null when income is 0 that period (undefined ratio, not zero). */
  rate: number | null;
  /** Running total of (income-expense), chronological order. */
  cumulativeSavings: number;
}

/**
 * Savings-rate-over-time line — the trajectory is the point, so unlike the
 * rest of Trends' Bar charts this is a Line (following SpendingPaceChart's
 * existing Line precedent). A null rate (no income that period) breaks the
 * line rather than bridging it — connecting across an undefined ratio would
 * fabricate a trend. Click a point to focus a period.
 */
export default function SavingsRateChart({
  data,
  currency,
  focusPeriodKey,
  onSelectPeriod,
}: {
  data: SavingsRatePoint[];
  currency: string;
  focusPeriodKey?: string | null;
  onSelectPeriod?: (periodKey: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Upload a statement to see your savings rate.
      </p>
    );
  }

  const focusPoint = data.find((d) => d.key === focusPeriodKey) ?? null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        onClick={(state) => {
          const row = data.find((d) => d.label === state?.activeLabel);
          if (row?.key && onSelectPeriod) onSelectPeriod(row.key);
        }}
      >
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: chart.baseline }}
          interval="preserveStartEnd"
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <ReferenceLine y={0} stroke={chart.baseline} strokeWidth={1} />
        <Tooltip
          cursor={{ stroke: chart.baseline, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as SavingsRatePoint;
            return (
              <div className="min-w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{label}</p>
                <p className="mt-1 font-medium tabular-nums text-zinc-900">
                  {row.rate === null ? "No income this period" : `${row.rate.toFixed(0)}% saved`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  <li className="flex items-center justify-between gap-4 text-zinc-600">
                    <span>Income</span>
                    <span className="tabular-nums text-zinc-900">
                      {formatMoney(row.income, currency)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-4 text-zinc-600">
                    <span>Expenses</span>
                    <span className="tabular-nums text-zinc-900">
                      {formatMoney(row.expense, currency)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-1 text-zinc-600">
                    <span>Cumulative saved</span>
                    <span className="tabular-nums text-zinc-900">
                      {formatMoney(row.cumulativeSavings, currency)}
                    </span>
                  </li>
                </ul>
              </div>
            );
          }}
        />
        <Line
          dataKey="rate"
          stroke={chart.accent}
          strokeWidth={2}
          dot={{ r: 3, fill: chart.accent, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        {focusPoint && focusPoint.rate !== null && (
          <ReferenceDot
            x={focusPoint.label}
            y={focusPoint.rate}
            r={5}
            fill={chart.accent}
            stroke="#fff"
            strokeWidth={2}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
