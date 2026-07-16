import {
  MONEY_IN_CATEGORY,
  NON_EXPENSE_CATEGORIES,
  Statement,
  Txn,
} from "@/lib/types";

/**
 * Expense semantics (used by every aggregate):
 * - "Payments & Transfers" is excluded from analytics entirely.
 * - Debits in any other category are expenses.
 * - Credits in an expense category (refunds) SUBTRACT from that category.
 * - "Income & Refunds" is money-in: excluded from expense charts, shown as a tile.
 */

export function isAnalyticsTxn(t: Txn): boolean {
  return !NON_EXPENSE_CATEGORIES.includes(t.category);
}

export function isExpenseCategory(category: string): boolean {
  return (
    !NON_EXPENSE_CATEGORIES.includes(category) && category !== MONEY_IN_CATEGORY
  );
}

function signed(t: Txn): number {
  return t.direction === "debit" ? t.amount : -t.amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net spend per expense category (refunds netted). Sorted descending. */
export function netByCategory(
  txns: Txn[],
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (!isExpenseCategory(t.category)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + signed(t));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

export function totalNetSpend(txns: Txn[]): number {
  return round2(
    netByCategory(txns).reduce((sum, c) => sum + Math.max(c.total, 0), 0),
  );
}

/** Money in: credits in Income & Refunds. */
export function totalMoneyIn(txns: Txn[]): number {
  return round2(
    txns
      .filter((t) => t.category === MONEY_IN_CATEGORY && t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0),
  );
}

export function topMerchants(
  txns: Txn[],
  limit = 10,
): Array<{ merchant: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    if (!isExpenseCategory(t.category)) continue;
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
export function byMonth(txns: Txn[]): Period[] {
  const buckets = new Map<string, { label: string; cats: Map<string, number> }>();
  for (const t of txns) {
    if (!isExpenseCategory(t.category)) continue;
    const month = t.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const bucket = buckets.get(month) ?? { label: monthLabel(month), cats: new Map() };
    bucket.cats.set(t.category, (bucket.cats.get(t.category) ?? 0) + signed(t));
    buckets.set(month, bucket);
  }
  return rollup(buckets).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Statement-period rollup: one column per uploaded statement (the billing
 * cycle), ordered by period start. Refund credits net against their category
 * inside each statement.
 */
export function byStatement(txns: Txn[], statements: Statement[]): Period[] {
  const ordered = [...statements].sort((a, b) =>
    (a.period_start || a.uploaded_at).localeCompare(b.period_start || b.uploaded_at),
  );
  const buckets = new Map<string, { label: string; cats: Map<string, number> }>();
  for (const s of ordered) {
    buckets.set(s.id, { label: statementLabel(s), cats: new Map() });
  }
  for (const t of txns) {
    if (!isExpenseCategory(t.category)) continue;
    const bucket = buckets.get(t.statement_id);
    if (!bucket) continue;
    bucket.cats.set(t.category, (bucket.cats.get(t.category) ?? 0) + signed(t));
  }
  // Keep statement order; drop statements with no expense transactions.
  return rollup(buckets).filter((p) => Object.keys(p.byCategory).length > 0);
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
