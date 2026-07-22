"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/analytics";
import StatTiles, { Tile } from "./StatTiles";
import SavingsRateChart, { SavingsRatePoint } from "./SavingsRateChart";

/**
 * Focus-driven summary for one period (default latest) plus the savings-rate
 * trend chart — click a point to change focus, mirroring the pattern used by
 * IncomeExpenseExplorer on the Income vs Expenditure dashboard.
 */
export default function SavingsRateExplorer({
  data,
  currency,
  periodNoun,
}: {
  data: SavingsRatePoint[];
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
        label: `Savings rate · ${focus.label}`,
        value: focus.rate === null ? "—" : `${focus.rate.toFixed(0)}%`,
        sub: focus.rate === null ? `no income this ${periodNoun}` : undefined,
        subTone: focus.rate === null ? "neutral" : focus.rate >= 0 ? "good" : "bad",
      },
      {
        label: "Cumulative savings",
        value: formatMoney(focus.cumulativeSavings, currency),
        subTone: focus.cumulativeSavings >= 0 ? "good" : "bad",
      },
    ];
  }, [focus, currency, periodNoun]);

  if (data.length === 0) {
    return <SavingsRateChart data={data} currency={currency} focusPeriodKey={null} />;
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
        . Click a point to change focus
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
        <SavingsRateChart
          data={data}
          currency={currency}
          focusPeriodKey={focus?.key ?? null}
          onSelectPeriod={setFocusKey}
        />
      </div>
    </div>
  );
}
