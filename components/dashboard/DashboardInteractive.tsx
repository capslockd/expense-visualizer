"use client";

import { useMemo, useState } from "react";
import { Txn } from "@/lib/types";
import {
  Period,
  formatMoney,
  isExpenseCategory,
  largestPurchase,
  merchantNetInPeriod,
  periodDaySpan,
  topMoverMerchant,
  txnInPeriod,
} from "@/lib/analytics";
import { chart, assignSlots } from "./chartTheme";
import StatTiles, { Tile } from "./StatTiles";
import TrendChart, { OTHER_KEY } from "./TrendChart";
import CategoryPie from "./CategoryPie";
import CategoryOrdersChart from "./CategoryOrdersChart";
import StatementPieModal from "./StatementPieModal";

/**
 * The context-sensitive top of the dashboard: 8 stat widgets scoped to the
 * focused statement (click any bar to change focus; default is the latest),
 * the trend chart with its category drill-down, and the per-statement pie
 * popup (click a statement's x-axis label).
 */
export default function DashboardInteractive({
  periods,
  rankedCategories,
  txns,
  currency,
  group,
  budgets,
}: {
  periods: Period[];
  rankedCategories: string[];
  txns: Txn[];
  currency: string;
  group: "statement" | "month";
  /** Per-cycle budget per category (only categories with a budget set). */
  budgets: Record<string, number>;
}) {
  const periodNoun = group === "statement" ? "statement" : "month";
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [drillPeriodKey, setDrillPeriodKey] = useState<string | null>(null);
  const [pieKey, setPieKey] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"bars" | "pie">("bars");
  // Pie scope: null = aggregate every visible period; else one period key.
  const [piePeriodKey, setPiePeriodKey] = useState<string | null>(null);
  // null = every category; otherwise the filtered set.
  const [filter, setFilter] = useState<Set<string> | null>(null);

  const visibleCategories = useMemo(
    () => (filter ? rankedCategories.filter((c) => filter.has(c)) : null),
    [filter, rankedCategories],
  );
  const budgetTotal = useMemo(() => {
    const cats = visibleCategories ?? rankedCategories;
    const sum = cats.reduce((s, c) => s + (budgets[c] ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }, [visibleCategories, rankedCategories, budgets]);

  function toggleFilter(category: string) {
    setFilter((prev) => {
      const next = new Set(prev ?? []);
      if (prev === null) {
        // From "all" → isolate the clicked category.
        return new Set([category]);
      }
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next.size === 0 || next.size === rankedCategories.length ? null : next;
    });
  }

  const focusIdx = useMemo(() => {
    const idx = periods.findIndex((p) => p.key === focusKey);
    return idx >= 0 ? idx : periods.length - 1;
  }, [periods, focusKey]);
  const focus = periods[focusIdx];
  const previous = focusIdx > 0 ? periods[focusIdx - 1] : null;

  // ------------------------------------------------------------ 8 widgets
  const tiles = useMemo<Tile[]>(() => {
    if (!focus) return [];
    const out: Tile[] = [];
    const deltaSub = (diff: number) =>
      `${diff >= 0 ? "+" : "−"}${formatMoney(Math.abs(diff), currency)} vs previous ${periodNoun}`;

    // 1. Net spend
    const spendDelta = previous ? focus.total - previous.total : null;
    out.push({
      label: `Net spend · ${focus.label}`,
      value: formatMoney(focus.total, currency),
      sub: spendDelta === null ? `first ${periodNoun} on record` : deltaSub(spendDelta),
      subTone: spendDelta === null ? "neutral" : spendDelta > 0 ? "bad" : "good",
    });

    // 2. Top category
    const topCat = Object.entries(focus.byCategory)
      .filter(([, net]) => net > 0)
      .sort((a, b) => b[1] - a[1])[0];
    out.push({
      label: "Top category",
      value: topCat?.[0] ?? "—",
      sub: topCat ? formatMoney(topCat[1], currency) : "no spending",
    });

    // 3. Top retailer
    let topMerchant: { name: string; total: number } | null = null;
    for (const [name, total] of merchantNetInPeriod(txns, group, focus.key)) {
      if (total > 0 && (!topMerchant || total > topMerchant.total)) {
        topMerchant = { name, total };
      }
    }
    out.push({
      label: "Top retailer",
      value: topMerchant?.name ?? "—",
      sub: topMerchant ? formatMoney(topMerchant.total, currency) : "no spending",
    });

    // 4. Biggest mover — category
    let catMover: { category: string; diff: number } | null = null;
    if (previous) {
      const cats = new Set([
        ...Object.keys(focus.byCategory),
        ...Object.keys(previous.byCategory),
      ]);
      for (const c of cats) {
        const diff = (focus.byCategory[c] ?? 0) - (previous.byCategory[c] ?? 0);
        if (!catMover || Math.abs(diff) > Math.abs(catMover.diff)) {
          catMover = { category: c, diff };
        }
      }
    }
    out.push({
      label: "Biggest mover · category",
      value: catMover?.category ?? "—",
      sub: catMover ? deltaSub(catMover.diff) : `needs a previous ${periodNoun}`,
      subTone: !catMover ? "neutral" : catMover.diff > 0 ? "bad" : "good",
    });

    // 5. Biggest mover — retailer
    const merchMover = previous
      ? topMoverMerchant(txns, group, focus.key, previous.key)
      : null;
    out.push({
      label: "Biggest mover · retailer",
      value: merchMover?.merchant ?? "—",
      sub: merchMover ? deltaSub(merchMover.diff) : `needs a previous ${periodNoun}`,
      subTone: !merchMover ? "neutral" : merchMover.diff > 0 ? "bad" : "good",
    });

    // 6. Transactions
    const periodTxns = txns.filter(
      (t) => isExpenseCategory(t.category) && txnInPeriod(t, group, focus.key),
    );
    const refunds = periodTxns.filter((t) => t.direction === "credit").length;
    out.push({
      label: "Transactions",
      value: String(periodTxns.length),
      sub: refunds > 0 ? `${refunds} refund${refunds === 1 ? "" : "s"} included` : "no refunds",
    });

    // 7. Daily average
    const span = periodDaySpan(txns, group, focus.key);
    out.push({
      label: "Daily average",
      value: span > 0 ? formatMoney(focus.total / span, currency) : "—",
      sub: span > 0 ? `over ${span} day${span === 1 ? "" : "s"}` : "no spending days",
    });

    // 8. Largest purchase
    const biggest = largestPurchase(txns, group, focus.key);
    out.push({
      label: "Largest purchase",
      value: biggest ? formatMoney(biggest.amount, currency) : "—",
      sub: biggest ? `${biggest.merchant} · ${biggest.date}` : "no purchases",
    });

    return out;
  }, [focus, previous, txns, group, currency, periodNoun]);

  // ------------------------------------------------------------ drill data
  const topSet = useMemo(
    () => new Set(rankedCategories.slice(0, chart.slots.length)),
    [rankedCategories],
  );
  const slots = useMemo(() => assignSlots(rankedCategories), [rankedCategories]);

  const drillTxns = useMemo(() => {
    if (!drillCategory) return [];
    return txns.filter((t) => {
      const inCategory =
        drillCategory === OTHER_KEY
          ? isExpenseCategory(t.category) && !topSet.has(t.category)
          : t.category === drillCategory;
      if (!inCategory || !isExpenseCategory(t.category)) return false;
      if (drillPeriodKey === null) return true;
      return txnInPeriod(t, group, drillPeriodKey);
    });
  }, [drillCategory, drillPeriodKey, txns, topSet, group]);

  const drillStats = useMemo(() => {
    let net = 0;
    let orders = 0;
    let refunds = 0;
    for (const t of drillTxns) {
      net += t.direction === "debit" ? t.amount : -t.amount;
      if (t.direction === "debit") orders += 1;
      else refunds += 1;
    }
    return { net: Math.round(net * 100) / 100, orders, refunds };
  }, [drillTxns]);

  const drillColor = drillCategory
    ? drillCategory === OTHER_KEY
      ? chart.fold
      : (slots.get(drillCategory) ?? chart.fold)
    : chart.fold;

  function handleSelectCategory(category: string, periodKey?: string) {
    if (periodKey) setFocusKey(periodKey); // clicking a bar focuses its statement
    setDrillCategory((prev) => (prev === category && !periodKey ? null : category));
    setDrillPeriodKey(periodKey ?? focus?.key ?? null);
  }

  const piePeriod = pieKey ? (periods.find((p) => p.key === pieKey) ?? null) : null;

  // Pie scope: the chosen period, or the whole visible window.
  const pieSelected = piePeriodKey
    ? (periods.find((p) => p.key === piePeriodKey) ?? null)
    : null;
  const piePeriods = pieSelected ? [pieSelected] : periods;

  function cyclePie(direction: 1 | -1) {
    // Order: All → first … last → All (wraps both ways).
    const keys: Array<string | null> = [null, ...periods.map((p) => p.key)];
    const idx = keys.findIndex((k) => k === (pieSelected ? pieSelected.key : null));
    const next = keys[(idx + direction + keys.length) % keys.length];
    setPiePeriodKey(next);
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
        . Click any bar to change focus
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

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Spend by category ·{" "}
              {group === "statement" ? "per statement (billing cycle)" : "per calendar month"}
            </h2>
            <p className="mb-2 text-xs text-zinc-500">
              Net of refunds · excludes card payments and transfers · {currency}
              {chartType === "bars" ? (
                <>
                  {" "}
                  · click a{" "}
                  <span className="underline decoration-dotted">{periodNoun} label</span>{" "}
                  for its pie breakdown
                </>
              ) : (
                <> · shares aggregated over the visible window — narrow to 1 for a single {periodNoun}</>
              )}
            </p>
          </div>
          <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm">
            {(
              [
                ["bars", "Bars"],
                ["pie", "Pie"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                className={`rounded-md px-3 py-1 ${
                  chartType === t
                    ? "bg-white font-medium text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Categories:</span>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              filter === null
                ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            All
          </button>
          {rankedCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleFilter(c)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                filter?.has(c)
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {c}
              {budgets[c] ? (
                <span className={filter?.has(c) ? "text-zinc-300" : "text-zinc-400"}>
                  {" "}
                  · {formatMoney(budgets[c], currency)}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {chartType === "bars" ? (
          <TrendChart
            periods={periods}
            rankedCategories={rankedCategories}
            currency={currency}
            selectedCategory={drillCategory}
            onSelectCategory={handleSelectCategory}
            focusPeriodKey={focus?.key ?? null}
            onSelectPeriodLabel={(key) => {
              setFocusKey(key);
              setPieKey(key);
            }}
            visibleCategories={visibleCategories}
            budgetTotal={budgetTotal}
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                Show {periodNoun}:
                <select
                  value={pieSelected?.key ?? "__all__"}
                  onChange={(e) =>
                    setPiePeriodKey(e.target.value === "__all__" ? null : e.target.value)
                  }
                  aria-label={`Pie ${periodNoun}`}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="__all__">
                    All {periods.length} {periodNoun}s (aggregate)
                  </option>
                  {periods.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cyclePie(-1)}
                  aria-label={`Previous ${periodNoun}`}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => cyclePie(1)}
                  aria-label={`Next ${periodNoun}`}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  ›
                </button>
              </div>
            </div>
            <CategoryPie
              periods={piePeriods}
              rankedCategories={rankedCategories}
              visibleCategories={visibleCategories}
              currency={currency}
              selectedCategory={drillCategory}
              onSelectCategory={(c) => {
                setDrillCategory((prev) => (prev === c ? null : c));
                // Drill matches the pie's scope: one period, or all of them.
                setDrillPeriodKey(pieSelected?.key ?? null);
              }}
              budgetTotal={budgetTotal}
            />
          </>
        )}

        {drillCategory && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: drillColor }}
                  />
                  {drillCategory} — every order, no aggregation
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {drillStats.orders} order{drillStats.orders === 1 ? "" : "s"}
                  {drillStats.refunds > 0 &&
                    `, ${drillStats.refunds} refund${drillStats.refunds === 1 ? "" : "s"}`}{" "}
                  · net {drillStats.net < 0 ? "−" : ""}
                  {formatMoney(Math.abs(drillStats.net), currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrillCategory(null)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Close ✕
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-zinc-500">Show {periodNoun}:</span>
              {periods.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDrillPeriodKey(p.key)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    drillPeriodKey === p.key
                      ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                      : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDrillPeriodKey(null)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  drillPeriodKey === null
                    ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                All {periodNoun}s
              </button>
            </div>

            <CategoryOrdersChart txns={drillTxns} currency={currency} color={drillColor} />
          </div>
        )}
      </section>

      {piePeriod && (
        <StatementPieModal
          period={piePeriod}
          txns={txns}
          rankedCategories={rankedCategories}
          currency={currency}
          group={group}
          onClose={() => setPieKey(null)}
        />
      )}
    </div>
  );
}
