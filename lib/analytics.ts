import { Direction, Statement, Txn } from "@/lib/types";

/**
 * Expense semantics (used by every aggregate in this file):
 * - Debits in a category are expenses; credits (refunds) SUBTRACT from it.
 * - Exclusion (card payments, ATM withdrawals, internal transfers, ...) and
 *   income are both handled entirely upstream of this file: callers use
 *   `partitionByType()` to split a user's transactions into expense/income
 *   slices — excluded-category transactions are dropped outright, the rest
 *   split by the category's `type` (user/sheet data this module never sees)
 *   — BEFORE calling anything below. Every function here can assume its
 *   input is already clean. Call `byMonth`/`byStatement`/`netByCategory`/etc.
 *   once per slice to get parallel expense and income aggregates.
 */

/**
 * Splits transactions into expense and income slices, dropping excluded
 * categories entirely. `incomeCategoryNames`/`excludedCategoryNames` are the
 * caller's live sets from `getCategories()` — this file has no notion of
 * category type or exclusion itself; both are user/sheet-driven.
 */
export function partitionByType(
  txns: Txn[],
  incomeCategoryNames: ReadonlySet<string>,
  excludedCategoryNames: ReadonlySet<string>,
): { expense: Txn[]; income: Txn[] } {
  const expense: Txn[] = [];
  const income: Txn[] = [];
  for (const t of txns) {
    if (excludedCategoryNames.has(t.category)) continue;
    if (incomeCategoryNames.has(t.category)) income.push(t);
    else expense.push(t);
  }
  return { expense, income };
}

/**
 * Signed contribution of a transaction toward its category's net.
 * `primary` is which direction counts as the "normal" flow for the slice
 * being aggregated — "debit" for expenses (a charge is positive, a refund
 * credit subtracts) or "credit" for income (a deposit is positive, a
 * correction/clawback debit subtracts). Every function below defaults to
 * "debit" so 100% of existing expense call sites are unchanged; income call
 * sites (Income Dashboard, Income vs Expenditure Dashboard) pass "credit".
 */
function signed(t: Txn, primary: Direction = "debit"): number {
  return t.direction === primary ? t.amount : -t.amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net per category (refunds/corrections netted against `primary`). Sorted descending. */
export function netByCategory(
  txns: Txn[],
  primary: Direction = "debit",
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>();
  for (const t of txns) {
    map.set(t.category, (map.get(t.category) ?? 0) + signed(t, primary));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

export function totalNetSpend(txns: Txn[], primary: Direction = "debit"): number {
  return round2(
    netByCategory(txns, primary).reduce((sum, c) => sum + Math.max(c.total, 0), 0),
  );
}

export function topMerchants(
  txns: Txn[],
  limit = 10,
): Array<{ merchant: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const cur = map.get(t.merchant) ?? { total: 0, count: 0 };
    cur.total += signed(t);
    cur.count += 1;
    map.set(t.merchant, cur);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, total: round2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** One column of the trend chart: a statement period or a calendar month. */
export interface Period {
  key: string;
  label: string;
  total: number; // sum of positive category nets (refunds deducted first)
  /** ACTUAL net per category — may be negative when refunds exceed spend. */
  byCategory: Record<string, number>;
}

function rollup(buckets: Map<string, { label: string; cats: Map<string, number> }>): Period[] {
  return [...buckets.entries()].map(([key, { label, cats }]) => {
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const [c, v] of cats) {
      const net = round2(v);
      byCategory[c] = net;
      total += Math.max(net, 0);
    }
    return { key, label, total: round2(total), byCategory };
  });
}

/** Calendar-month rollup (from transaction dates, so overlapping statements aggregate sanely). */
export function byMonth(txns: Txn[], primary: Direction = "debit"): Period[] {
  const buckets = new Map<string, { label: string; cats: Map<string, number> }>();
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const bucket = buckets.get(month) ?? { label: monthLabel(month), cats: new Map() };
    bucket.cats.set(t.category, (bucket.cats.get(t.category) ?? 0) + signed(t, primary));
    buckets.set(month, bucket);
  }
  return rollup(buckets).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Statement-period rollup: one column per uploaded statement (the billing
 * cycle), ordered by period start. Refund/correction credits net against
 * their category inside each statement.
 */
export function byStatement(
  txns: Txn[],
  statements: Statement[],
  primary: Direction = "debit",
): Period[] {
  const ordered = [...statements].sort((a, b) =>
    (a.period_start || a.uploaded_at).localeCompare(b.period_start || b.uploaded_at),
  );
  const buckets = new Map<string, { label: string; cats: Map<string, number> }>();
  for (const s of ordered) {
    buckets.set(s.id, { label: statementLabel(s), cats: new Map() });
  }
  for (const t of txns) {
    const bucket = buckets.get(t.statement_id);
    if (!bucket) continue;
    bucket.cats.set(t.category, (bucket.cats.get(t.category) ?? 0) + signed(t, primary));
  }
  // Keep statement order; drop statements with no matching transactions.
  return rollup(buckets).filter((p) => Object.keys(p.byCategory).length > 0);
}

/** Does a transaction fall inside a trend-chart bucket? */
export function txnInPeriod(
  t: Txn,
  group: "statement" | "month",
  periodKey: string,
): boolean {
  return group === "statement"
    ? t.statement_id === periodKey
    : t.date.startsWith(periodKey);
}

export interface TopMerchantEntry {
  /** Scope key: the period key (per-period rows) or category name. */
  key: string;
  label: string;
  merchant: string;
  total: number; // net of refunds
}

/** The #1 merchant (by net) inside each period bucket. */
export function topMerchantPerPeriod(
  txns: Txn[],
  periods: Period[],
  group: "statement" | "month",
  primary: Direction = "debit",
): TopMerchantEntry[] {
  const out: TopMerchantEntry[] = [];
  for (const p of periods) {
    const map = new Map<string, number>();
    for (const t of txns) {
      if (!txnInPeriod(t, group, p.key)) continue;
      map.set(t.merchant, (map.get(t.merchant) ?? 0) + signed(t, primary));
    }
    let best: { merchant: string; total: number } | null = null;
    for (const [merchant, total] of map) {
      if (!best || total > best.total) best = { merchant, total };
    }
    if (best && best.total > 0) {
      out.push({ key: p.key, label: p.label, merchant: best.merchant, total: round2(best.total) });
    }
  }
  return out;
}

/** The #1 merchant (by net) inside each category. */
export function topMerchantPerCategory(
  txns: Txn[],
  primary: Direction = "debit",
): TopMerchantEntry[] {
  const byCat = new Map<string, Map<string, number>>();
  for (const t of txns) {
    const m = byCat.get(t.category) ?? new Map<string, number>();
    m.set(t.merchant, (m.get(t.merchant) ?? 0) + signed(t, primary));
    byCat.set(t.category, m);
  }
  const out: TopMerchantEntry[] = [];
  for (const [category, merchants] of byCat) {
    let best: { merchant: string; total: number } | null = null;
    for (const [merchant, total] of merchants) {
      if (!best || total > best.total) best = { merchant, total };
    }
    if (best && best.total > 0) {
      out.push({ key: category, label: category, merchant: best.merchant, total: round2(best.total) });
    }
  }
  return out.sort((a, b) => b.total - a.total);
}

/**
 * Cumulative spend through a period, day by day — powers the pace chart.
 * Day index is 1-based position within the period so two cycles align.
 */
export function cumulativeSpend(
  txns: Txn[],
  group: "statement" | "month",
  periodKey: string,
  primary: Direction = "debit",
): Array<{ day: number; cum: number }> {
  const inPeriod = txns
    .filter((t) => txnInPeriod(t, group, periodKey))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inPeriod.length === 0) return [];
  const firstDate = inPeriod[0].date;
  const dayOf = (iso: string) =>
    Math.floor(
      (new Date(iso).getTime() - new Date(firstDate).getTime()) / 86_400_000,
    ) + 1;
  const byDay = new Map<number, number>();
  for (const t of inPeriod) {
    const d = dayOf(t.date);
    byDay.set(d, (byDay.get(d) ?? 0) + signed(t, primary));
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const out: Array<{ day: number; cum: number }> = [];
  let cum = 0;
  for (const d of days) {
    cum += byDay.get(d) ?? 0;
    out.push({ day: d, cum: round2(cum) });
  }
  return out;
}

/**
 * Average of several cumulative curves, day-aligned. For each day index,
 * every curve contributes its value at min(day, its last day) — a finished
 * cycle carries its final total forward so the average doesn't dip.
 */
export function averageCumulative(
  curves: Array<Array<{ day: number; cum: number }>>,
): Array<{ day: number; cum: number }> {
  const nonEmpty = curves.filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return [];
  const maxDay = Math.max(...nonEmpty.map((c) => c[c.length - 1].day));
  const out: Array<{ day: number; cum: number }> = [];
  for (let day = 1; day <= maxDay; day++) {
    let sum = 0;
    for (const curve of nonEmpty) {
      let val = 0;
      for (const p of curve) {
        if (p.day <= day) val = p.cum;
        else break;
      }
      sum += val;
    }
    out.push({ day, cum: round2(sum / nonEmpty.length) });
  }
  return out;
}

/** Highest-spend days (net of refunds) with each day's biggest merchant. */
export function topSpendDays(
  txns: Txn[],
  limit = 3,
  primary: Direction = "debit",
): Array<{ date: string; total: number; topMerchant: string; count: number }> {
  const byDate = new Map<string, { total: number; count: number; merchants: Map<string, number> }>();
  for (const t of txns) {
    const d = byDate.get(t.date) ?? { total: 0, count: 0, merchants: new Map() };
    d.total += signed(t, primary);
    d.count += 1;
    d.merchants.set(t.merchant, (d.merchants.get(t.merchant) ?? 0) + signed(t, primary));
    byDate.set(t.date, d);
  }
  return [...byDate.entries()]
    .map(([date, d]) => {
      let top = "";
      let topVal = -Infinity;
      for (const [m, v] of d.merchants) {
        if (v > topVal) {
          top = m;
          topVal = v;
        }
      }
      return { date, total: round2(d.total), topMerchant: top, count: d.count };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Net per merchant within one period bucket. */
export function merchantNetInPeriod(
  txns: Txn[],
  group: "statement" | "month",
  periodKey: string,
  primary: Direction = "debit",
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (!txnInPeriod(t, group, periodKey)) continue;
    map.set(t.merchant, round2((map.get(t.merchant) ?? 0) + signed(t, primary)));
  }
  return map;
}

/** The merchant whose net changed the most between two periods. */
export function topMoverMerchant(
  txns: Txn[],
  group: "statement" | "month",
  currentKey: string,
  previousKey: string,
  primary: Direction = "debit",
): { merchant: string; diff: number } | null {
  const cur = merchantNetInPeriod(txns, group, currentKey, primary);
  const prev = merchantNetInPeriod(txns, group, previousKey, primary);
  let best: { merchant: string; diff: number } | null = null;
  for (const merchant of new Set([...cur.keys(), ...prev.keys()])) {
    const diff = round2((cur.get(merchant) ?? 0) - (prev.get(merchant) ?? 0));
    if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { merchant, diff };
  }
  return best && best.diff !== 0 ? best : null;
}

/** The single largest transaction in the primary direction (a charge for expense, a deposit for income) in a period. */
export function largestPurchase(
  txns: Txn[],
  group: "statement" | "month",
  periodKey: string,
  primary: Direction = "debit",
): Txn | null {
  let best: Txn | null = null;
  for (const t of txns) {
    if (t.direction !== primary) continue;
    if (!txnInPeriod(t, group, periodKey)) continue;
    if (!best || t.amount > best.amount) best = t;
  }
  return best;
}

/** Inclusive day span covered by a period's transactions (≥ 1 when any exist). */
export function periodDaySpan(
  txns: Txn[],
  group: "statement" | "month",
  periodKey: string,
): number {
  let min: string | null = null;
  let max: string | null = null;
  for (const t of txns) {
    if (!txnInPeriod(t, group, periodKey)) continue;
    if (!min || t.date < min) min = t.date;
    if (!max || t.date > max) max = t.date;
  }
  if (!min || !max) return 0;
  return (
    Math.floor(
      (new Date(`${max}T00:00:00Z`).getTime() - new Date(`${min}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Weekday short name for an ISO date, e.g. "2026-07-17" → "Fri". */
export function weekdayOf(dateIso: string): (typeof WEEKDAYS)[number] | "" {
  const parsed = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return WEEKDAYS[(parsed.getUTCDay() + 6) % 7];
}

/** Net per day of week (Mon-first), for "which weekday costs/pays the most?". */
export function byWeekday(
  txns: Txn[],
  primary: Direction = "debit",
): Array<{ weekday: (typeof WEEKDAYS)[number]; total: number; count: number }> {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const t of txns) {
    const parsed = new Date(`${t.date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) continue;
    const idx = (parsed.getUTCDay() + 6) % 7; // Sunday(0) → 6, Monday(1) → 0
    totals[idx] += signed(t, primary);
    counts[idx] += 1;
  }
  return WEEKDAYS.map((weekday, i) => ({
    weekday,
    total: round2(totals[i]),
    count: counts[i],
  }));
}

/**
 * Merchant rollup within one category — powers the legend drill-down.
 * `total` is net of refunds; `orders` counts debit transactions (a refund is
 * not an order, it just reduces the merchant's net); `refunds` counts credits.
 */
export function merchantsInCategory(
  txns: Txn[],
  category: string,
): Array<{ merchant: string; total: number; orders: number; refunds: number }> {
  const map = new Map<string, { total: number; orders: number; refunds: number }>();
  for (const t of txns) {
    if (t.category !== category) continue;
    const cur = map.get(t.merchant) ?? { total: 0, orders: 0, refunds: 0 };
    cur.total += signed(t);
    if (t.direction === "debit") cur.orders += 1;
    else cur.refunds += 1;
    map.set(t.merchant, cur);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, ...v, total: round2(v.total) }))
    .sort((a, b) => b.total - a.total);
}

/** Currencies present, most-used first. */
export function currenciesOf(txns: Txn[]): string[] {
  const counts = new Map<string, number>();
  for (const t of txns) {
    counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en", {
    month: "short",
    year: "2-digit",
  });
}

function shortDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
  });
}

/**
 * Chart label for a statement column — the friendly name when set, else the
 * period dates (dates stay visible in tooltips/subtitles regardless).
 */
export function statementLabel(s: Statement): string {
  if (s.title) return s.title;
  if (s.period_start && s.period_end) {
    return `${shortDate(s.period_start)} – ${shortDate(s.period_end, true)}`;
  }
  return `Uploaded ${shortDate(s.uploaded_at, true)}`;
}
