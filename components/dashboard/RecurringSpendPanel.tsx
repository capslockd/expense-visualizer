"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryType, Txn } from "@/lib/types";
import { formatMoney, RecurringCadence, RecurringMerchant } from "@/lib/analytics";
import StatTiles, { Tile } from "./StatTiles";
import EditableTxnTable from "./EditableTxnTable";

const CADENCE_LABEL: Record<RecurringCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

/**
 * Detected recurring merchants with dismiss/restore (persisted via
 * /api/recurring-dismissals) and a click-to-drill transaction list. Stat
 * tiles and the monthly-spend total only count currently-visible (non-
 * dismissed) merchants.
 */
export default function RecurringSpendPanel({
  recurring,
  dismissedMerchants,
  txns,
  categories,
  currency,
}: {
  recurring: RecurringMerchant[];
  dismissedMerchants: string[];
  /** Expense-slice, full currency history — the drill-down filters this by merchant_normalized. */
  txns: Txn[];
  categories: { name: string; type: CategoryType }[];
  currency: string;
}) {
  const router = useRouter();
  const [dismissedLocal, setDismissedLocal] = useState(() => new Set(dismissedMerchants));
  const [busyMerchant, setBusyMerchant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const visible = useMemo(
    () => recurring.filter((r) => !dismissedLocal.has(r.merchantNormalized)),
    [recurring, dismissedLocal],
  );
  const dismissed = useMemo(
    () => recurring.filter((r) => dismissedLocal.has(r.merchantNormalized)),
    [recurring, dismissedLocal],
  );

  const tiles = useMemo<Tile[]>(() => {
    const monthlyTotal =
      Math.round(visible.reduce((s, r) => s + r.monthlyEquivalent, 0) * 100) / 100;
    const priceIncreases = visible.filter((r) => r.priceChanged).length;
    return [
      { label: "Recurring merchants", value: String(visible.length) },
      {
        label: "Est. monthly recurring spend",
        value: formatMoney(monthlyTotal, currency),
      },
      {
        label: "Priciest subscription",
        value: visible[0]?.merchant ?? "—",
        sub: visible[0] ? `${formatMoney(visible[0].monthlyEquivalent, currency)}/mo` : "none detected",
      },
      {
        label: "Price increases flagged",
        value: String(priceIncreases),
        subTone: priceIncreases > 0 ? "bad" : "neutral",
      },
    ];
  }, [visible, currency]);

  const drillTxns = useMemo(() => {
    if (!selectedMerchant) return [];
    return txns
      .filter((t) => t.merchant_normalized === selectedMerchant)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMerchant, txns]);

  async function setDismissed(merchantNormalized: string, dismiss: boolean) {
    setBusyMerchant(merchantNormalized);
    setError(null);
    setDismissedLocal((prev) => {
      const next = new Set(prev);
      if (dismiss) next.add(merchantNormalized);
      else next.delete(merchantNormalized);
      return next;
    });
    try {
      const res = await fetch("/api/recurring-dismissals", {
        method: dismiss ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_normalized: merchantNormalized }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error?.message ??
            `Could not ${dismiss ? "dismiss" : "restore"} this merchant.`,
        );
        setDismissedLocal((prev) => {
          const next = new Set(prev);
          if (dismiss) next.delete(merchantNormalized);
          else next.add(merchantNormalized);
          return next;
        });
        return;
      }
      router.refresh();
    } catch {
      setError(`Could not ${dismiss ? "dismiss" : "restore"} this merchant — check your connection.`);
      setDismissedLocal((prev) => {
        const next = new Set(prev);
        if (dismiss) next.delete(merchantNormalized);
        else next.add(merchantNormalized);
        return next;
      });
    } finally {
      setBusyMerchant(null);
    }
  }

  if (recurring.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No recurring merchants detected yet — this needs at least 3 similarly-timed
        charges from the same merchant.
      </p>
    );
  }

  return (
    <div>
      <StatTiles tiles={tiles} />

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Every detected merchant is dismissed.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 font-medium">Merchant</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Cadence</th>
                <th className="px-3 py-2 text-right font-medium">Latest charge</th>
                <th className="px-3 py-2 text-right font-medium">Monthly equiv.</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.merchantNormalized}
                  className={`border-b border-zinc-100 last:border-0 ${
                    busyMerchant === r.merchantNormalized ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMerchant((prev) =>
                          prev === r.merchantNormalized ? null : r.merchantNormalized,
                        )
                      }
                      className="text-left font-medium text-zinc-900 hover:underline"
                    >
                      {r.merchant}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.category}</td>
                  <td className="px-3 py-2 text-zinc-600">{CADENCE_LABEL[r.cadence]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-900">
                    {formatMoney(r.latestAmount, currency)}
                    {r.priceChanged && (
                      <span
                        className={`ml-1 ${
                          r.priceChangePct > 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {r.priceChangePct > 0 ? "▲" : "▼"} {Math.abs(r.priceChangePct).toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-600">
                    {formatMoney(r.monthlyEquivalent, currency)}/mo
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{r.lastSeen}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busyMerchant === r.merchantNormalized}
                      onClick={() => setDismissed(r.merchantNormalized, true)}
                      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dismissed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-700"
          >
            {showDismissed ? "Hide" : "Show"} dismissed ({dismissed.length})
          </button>
          {showDismissed && (
            <ul className="mt-2 space-y-1">
              {dismissed.map((r) => (
                <li
                  key={r.merchantNormalized}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs"
                >
                  <span className="text-zinc-600">
                    {r.merchant} · {formatMoney(r.monthlyEquivalent, currency)}/mo
                  </span>
                  <button
                    type="button"
                    disabled={busyMerchant === r.merchantNormalized}
                    onClick={() => setDismissed(r.merchantNormalized, false)}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-0.5 text-zinc-600 hover:bg-zinc-100"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedMerchant && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              {recurring.find((r) => r.merchantNormalized === selectedMerchant)?.merchant ??
                selectedMerchant}{" "}
              — every transaction
            </h3>
            <button
              type="button"
              onClick={() => setSelectedMerchant(null)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Close ✕
            </button>
          </div>
          <EditableTxnTable txns={drillTxns} categories={categories} />
        </div>
      )}
    </div>
  );
}
