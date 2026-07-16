import {
  MONEY_IN_CATEGORY,
  NON_EXPENSE_CATEGORIES,
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

/** Calendar-month rollup (from transaction dates, so overlapping statements aggregate sanely). */
export function byMonth(
  txns: Txn[],
): Array<{ month: string; total: number; byCategory: Record<string, number> }> {
  const months = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (!isExpenseCategory(t.category)) continue;
    const month = t.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const cat = months.get(month) ?? new Map<string, number>();
    cat.set(t.category, (cat.get(t.category) ?? 0) + signed(t));
    months.set(month, cat);
  }
  return [...months.entries()]
    .map(([month, cats]) => {
      const byCategory: Record<string, number> = {};
      let total = 0;
      for (const [c, v] of cats) {
        const net = round2(v);
        byCategory[c] = net;
        total += Math.max(net, 0);
      }
      return { month, total: round2(total), byCategory };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
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
