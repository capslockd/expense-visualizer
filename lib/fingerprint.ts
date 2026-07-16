import crypto from "node:crypto";

/**
 * Content fingerprint for duplicate-upload detection.
 * Built from the statement's substance (period, account, transaction shape)
 * rather than file bytes, so re-exports with cosmetic differences still match.
 */
export function statementFingerprint(input: {
  period_start: string | null;
  period_end: string | null;
  account_hint: string | null;
  transactions: Array<{ date: string; amount: number; direction: string }>;
}): string {
  const tuples = input.transactions
    .map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.direction}`)
    .sort();
  const sum = input.transactions
    .reduce((acc, t) => acc + t.amount, 0)
    .toFixed(2);
  const material = [
    input.period_start ?? "",
    input.period_end ?? "",
    input.account_hint ?? "",
    String(input.transactions.length),
    sum,
    ...tuples,
  ].join("\n");
  return crypto.createHash("sha256").update(material).digest("hex");
}
