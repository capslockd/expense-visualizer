"use client";

import { useMemo, useState } from "react";
import { Txn } from "@/lib/types";
import {
  Period,
  averageCumulative,
  byWeekday,
  cumulativeSpend,
  formatMoney,
  topSpendDays,
  txnInPeriod,
  weekdayOf,
} from "@/lib/analytics";
import SpendingPaceChart, { PaceSeries } from "./SpendingPaceChart";
import WeekdayChart from "./WeekdayChart";

type Mode = "previous" | "all" | "average";
type Level = "statement" | "month";

/**
 * Spending-pace section with its own statement/month level (independent of
 * the page grouping — statements usually run 16th→15th, so both cuts are
 * useful). Pick a focus cycle, compare vs previous / all / average, with the
 * aggregate budget as a red target line. Highest-spend days (top 10, with
 * weekday) and the day-of-week breakdown follow the same scope.
 */
export default function PaceExplorer({
  statementPeriods,
  monthPeriods,
  txns,
  currency,
  defaultLevel,
  budgetTotal,
}: {
  statementPeriods: Period[];
  monthPeriods: Period[];
  txns: Txn[];
  currency: string;
  defaultLevel: Level;
  /** Aggregate per-cycle budget across all categories (red target line). */
  budgetTotal: number | null;
}) {
  const [level, setLevel] = useState<Level>(defaultLevel);
  const [mode, setMode] = useState<Mode>("previous");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const periods = level === "statement" ? statementPeriods : monthPeriods;
  const periodNoun = level;

  const focusIdx = useMemo(() => {
    const idx = periods.findIndex((p) => p.key === focusKey);
    return idx >= 0 ? idx : periods.length - 1;
  }, [periods, focusKey]);
  const focus = periods[focusIdx];
  const previous = focusIdx > 0 ? periods[focusIdx - 1] : null;

  const curves = useMemo(() => {
    const map = new Map<string, Array<{ day: number; cum: number }>>();
    for (const p of periods) {
      map.set(p.key, cumulativeSpend(txns, level, p.key));
    }
    return map;
  }, [periods, txns, level]);

  const series = useMemo<PaceSeries[]>(() => {
    if (!focus) return [];
    const focusSeries: PaceSeries = {
      key: focus.key,
      label: focus.label,
      points: curves.get(focus.key) ?? [],
      variant: "accent",
    };
    if (mode === "all") {
      return [
        ...periods
          .filter((p) => p.key !== focus.key)
          .map<PaceSeries>((p) => ({
            key: p.key,
            label: p.label,
            points: curves.get(p.key) ?? [],
            variant: "muted",
          })),
        focusSeries,
      ];
    }
    if (mode === "average") {
      return [
        {
          key: "__avg__",
          label: `Average of ${periods.length} ${periodNoun}s`,
          points: averageCumulative(periods.map((p) => curves.get(p.key) ?? [])),
          variant: "average",
        },
        focusSeries,
      ];
    }
    return [
      ...(previous
        ? [
            {
              key: previous.key,
              label: previous.label,
              points: curves.get(previous.key) ?? [],
              variant: "muted" as const,
            },
          ]
        : []),
      focusSeries,
    ];
  }, [mode, focus, previous, periods, curves, periodNoun]);

  // Top-spend days + weekday breakdown share the scope: the focus cycle,
  // or every visible cycle when comparing all.
  const scopedTxns = useMemo(() => {
    if (mode === "all") {
      return txns.filter((t) => periods.some((p) => txnInPeriod(t, level, p.key)));
    }
    if (!focus) return [];
    return txns.filter((t) => txnInPeriod(t, level, focus.key));
  }, [mode, focus, txns, level, periods]);
  const scopeLabel = mode === "all" ? `all ${periodNoun}s` : (focus?.label ?? "");

  const topDays = useMemo(() => topSpendDays(scopedTxns, 10), [scopedTxns]);
  const weekdays = useMemo(() => byWeekday(scopedTxns), [scopedTxns]);

  const subtitle =
    mode === "previous"
      ? previous
        ? `${focus?.label} vs ${previous.label}`
        : `${focus?.label} — first ${periodNoun}, nothing earlier to compare`
      : mode === "all"
        ? `${focus?.label} highlighted against every ${periodNoun}`
        : `${focus?.label} vs the average of all ${periods.length} ${periodNoun}s`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm">
          {(
            [
              ["statement", "By statement"],
              ["month", "By month"],
            ] as const
          ).map(([l, label]) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLevel(l);
                setFocusKey(null);
              }}
              className={`rounded-md px-3 py-1 ${
                level === l
                  ? "bg-white font-medium text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm">
          {(
            [
              ["previous", "vs previous"],
              ["all", `All ${periodNoun}s`],
              ["average", "vs average"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 ${
                mode === m
                  ? "bg-white font-medium text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Focus:</span>
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFocusKey(p.key)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                focus?.key === p.key
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-zinc-500">{subtitle}</p>
      <SpendingPaceChart series={series} currency={currency} budgetTotal={budgetTotal} />

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Highest-spend days
          </h3>
          <p className="mb-3 text-xs text-zinc-500">
            Top 10 net-spend days in {scopeLabel}
          </p>
          {topDays.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No spending days yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {topDays.map((d, i) => (
                <li
                  key={d.date}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-1.5"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      i === 0 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      <span
                        className={`mr-1.5 inline-block w-9 rounded px-1 text-center text-[10px] font-semibold uppercase ${
                          weekdayOf(d.date) === "Sat" || weekdayOf(d.date) === "Sun"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {weekdayOf(d.date)}
                      </span>
                      {d.date}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {d.count} txn{d.count === 1 ? "" : "s"} · mostly {d.topMerchant}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-zinc-900">
                    {formatMoney(d.total, currency)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Spending by day of week
          </h3>
          <p className="mb-1 text-xs text-zinc-500">
            Net spend per weekday in {scopeLabel} — the biggest day is highlighted
          </p>
          <WeekdayChart data={weekdays} currency={currency} />
        </div>
      </div>
    </div>
  );
}
