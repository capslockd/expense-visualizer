"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/analytics";
import StatTiles, { Tile } from "./StatTiles";
import IncomeExpenseChart, { IncomeExpensePoint } from "./IncomeExpenseChart";

/**
 * Focus-driven summary for one period (default latest) plus the full
 * income-vs-expense chart — click a bar to change focus, mirroring the
 * pattern used on the Expense/Income dashboards.
 */
export default function IncomeExpenseExplorer({
  data,
  currency,
  periodNoun,
}: {
  data: IncomeExpensePoint[];
  currency: string;
  periodNoun: string;
}) {
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const focusIdx = useMemo(() => {
    const idx = data.findIndex((d) => d.key === focusKey);
    return idx >= 0 ? idx : data.length - 1;
  }, [data, focusKey]);
  const focus = data[focusIdx];

  const tiles = useMemo<Tile[]>(() => {
    if (!focus) return [];
    const net = Math.round((focus.income - focus.expense) * 100) / 100;
    const coverage = focus.expense > 0 ? (focus.income / focus.expense) * 100 : null;
    return [
      {
        label: `Income · ${focus.label}`,
        value: formatMoney(focus.income, currency),
      },
      {
        label: `Expenses · ${focus.label}`,
        value: formatMoney(focus.expense, currency),
      },
      {
        label: net < 0 ? "Shortfall" : "Surplus",
        value: `${net < 0 ? "−" : "+"}${formatMoney(Math.abs(net), currency)}`,
        subTone: net < 0 ? "bad" : "good",
      },
      {
        label: "Income covers",
        value: coverage === null ? "—" : `${coverage.toFixed(0)}%`,
        sub: coverage === null ? `no expenses this ${periodNoun}` : "of expenses",
        subTone: coverage === null ? "neutral" : coverage >= 100 ? "good" : "bad",
      },
    ];
  }, [focus, currency, periodNoun]);

  if (data.length === 0) {
    return (
      <IncomeExpenseChart data={data} currency={currency} focusPeriodKey={null} />
    );
  }

  return (
    <div>
      <StatTiles tiles={tiles} />
      <p className="mt-2 text-xs text-zinc-400">
        Widgets follow the focused {periodNoun}
        {focus ? (
          <>
            {" "}
            — currently <span className="font-medium text-zinc-600">{focus.label}</span>
          </>
        ) : null}
        . Click a bar to change focus
        {focusKey ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setFocusKey(null)}
              className="underline decoration-dotted hover:text-zinc-700"
            >
              reset to latest
            </button>
          </>
        ) : null}
      </p>
      <div className="mt-4">
        <IncomeExpenseChart
          data={data}
          currency={currency}
          focusPeriodKey={focus?.key ?? null}
          onSelectPeriod={setFocusKey}
        />
      </div>
    </div>
  );
}
