"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

export interface IncomeExpensePoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

/**
 * Income vs Expenditure: one grouped pair of bars per period, sharing a
 * single $ axis (same unit, not a dual-axis chart). Click a bar to change
 * the focused period; the focused pair renders solid, the rest dim.
 */
export default function IncomeExpenseChart({
  data,
  currency,
  focusPeriodKey,
  onSelectPeriod,
}: {
  data: IncomeExpensePoint[];
  currency: string;
  focusPeriodKey?: string | null;
  onSelectPeriod?: (periodKey: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Upload a statement to see income vs expenses.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        barCategoryGap="28%"
        barGap={4}
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
          width={56}
          tick={{ fill: chart.inkMuted, fontSize: 11 }}
          tickFormatter={(v) => formatMoney(Number(v), currency)}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as IncomeExpensePoint;
            const net = Math.round((row.income - row.expense) * 100) / 100;
            return (
              <div className="min-w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-medium text-zinc-900">{label}</p>
                <ul className="mt-1 space-y-0.5">
                  <li className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ background: chart.incomeSeries }}
                      />
                      Income
                    </span>
                    <span className="tabular-nums text-zinc-900">
                      {formatMoney(row.income, currency)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ background: chart.expenseSeries }}
                      />
                      Expenses
                    </span>
                    <span className="tabular-nums text-zinc-900">
                      {formatMoney(row.expense, currency)}
                    </span>
                  </li>
                </ul>
                <p
                  className={`mt-1.5 border-t border-zinc-100 pt-1 font-medium tabular-nums ${
                    net < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {net < 0 ? "Shortfall" : "Surplus"} {net < 0 ? "−" : "+"}
                  {formatMoney(Math.abs(net), currency)}
                </p>
              </div>
            );
          }}
        />
        <Legend
          iconType="square"
          iconSize={9}
          wrapperStyle={{ fontSize: 12, color: chart.inkSecondary, paddingTop: 8 }}
        />
        <Bar
          dataKey="expense"
          name="Expenses"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
          cursor={onSelectPeriod ? "pointer" : undefined}
          onClick={(d) => {
            const row = d as { key?: string };
            if (row?.key && onSelectPeriod) onSelectPeriod(row.key);
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.key}
              fill={chart.expenseSeries}
              fillOpacity={focusPeriodKey && focusPeriodKey !== d.key ? 0.45 : 1}
            />
          ))}
        </Bar>
        <Bar
          dataKey="income"
          name="Income"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
          cursor={onSelectPeriod ? "pointer" : undefined}
          onClick={(d) => {
            const row = d as { key?: string };
            if (row?.key && onSelectPeriod) onSelectPeriod(row.key);
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.key}
              fill={chart.incomeSeries}
              fillOpacity={focusPeriodKey && focusPeriodKey !== d.key ? 0.45 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
