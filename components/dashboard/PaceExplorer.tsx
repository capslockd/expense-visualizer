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
} from "@/lib/analytics";
import SpendingPaceChart, { PaceSeries } from "./SpendingPaceChart";
import WeekdayChart from "./WeekdayChart";

type Mode = "previous" | "all" | "average";

/**
 * Spending-pace section: pick a focus statement/month, then compare it
 * against the previous cycle, every cycle, or the average of all cycles.
 * The highest-spend days and the day-of-week breakdown follow the same scope.
 */
export default function PaceExplorer({
  periods,
  txns,
  currency,
  group,
}: {
  periods: Period[];
  txns: Txn[];
  currency: string;
  group: "statement" | "month";
}) {
  const periodNoun = group === "statement" ? "statement" : "month";
  const [mode, setMode] = useState<Mode>("previous");
  const [focusKey, setFocusKey] = useState<string | null>(
    periods[periods.length - 1]?.key ?? null,
  );

  const focusIdx = periods.findIndex((p) => p.key === focusKey);
  const focus = focusIdx >= 0 ? periods[focusIdx] : periods[periods.length - 1];
  const previous = focusIdx > 0 ? periods[focusIdx - 1] : null;

  const curves = useMemo(() => {
    const map = new Map<string, Array<{ day: number; cum: number }>>();
    for (const p of periods) {
      map.set(p.key, cumulativeSpend(txns, group, p.key));
    }
    return map;
  }, [periods, txns, group]);

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
    // vs previous
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
  // or everything when comparing all cycles.
  const scopedTxns = useMemo(() => {
    if (mode === "all") return txns;
    if (!focus) return [];
    return txns.filter((t) => txnInPeriod(t, group, focus.key));
  }, [mode, focus, txns, group]);
  const scopeLabel = mode === "all" ? `all ${periodNoun}s` : (focus?.label ?? "");

  const topDays = useMemo(() => topSpendDays(scopedTxns, 3), [scopedTxns]);
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
      <SpendingPaceChart series={series} currency={currency} />

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Highest-spend days
          </h3>
          <p className="mb-3 text-xs text-zinc-500">
            Biggest net-spend days in {scopeLabel}
          </p>
          {topDays.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No spending days yet.</p>
          ) : (
            <ol className="space-y-2">
              {topDays.map((d, i) => (
                <li
                  key={d.date}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      i === 0 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{d.date}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {d.count} transaction{d.count === 1 ? "" : "s"} · mostly{" "}
                      {d.topMerchant}
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
