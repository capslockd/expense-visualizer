"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryType, Txn } from "@/lib/types";
import { formatMoney } from "@/lib/analytics";
import CategorySelect from "@/components/upload/CategorySelect";
import ConfirmModal from "@/components/ui/ConfirmModal";

/**
 * Transaction table with inline re-categorization. Changing a category saves
 * immediately (and updates the learned merchant rule for future statements).
 * Pass `allowDelete` to also offer per-row deletion — off by default since
 * this table is reused in drill-down views where deleting isn't appropriate.
 */
export default function EditableTxnTable({
  txns,
  categories: initialCategories,
  allowDelete = false,
}: {
  txns: Txn[];
  categories: { name: string; type: CategoryType }[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic overrides so the dropdown reflects the change instantly.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Optimistic removals so a deleted row disappears immediately.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [confirmTxn, setConfirmTxn] = useState<Txn | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleChange(txn: Txn, category: string) {
    if (category === (overrides[txn.id] ?? txn.category)) return;
    setBusy(txn.id);
    setError(null);
    setOverrides((prev) => ({ ...prev, [txn.id]: category }));
    try {
      const res = await fetch(`/api/transactions/${txn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Could not update the category.");
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[txn.id];
          return next;
        });
        return;
      }
      router.refresh(); // recompute charts/tiles server-side
    } catch {
      setError("Could not update the category — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddCategory(
    name: string,
    type: CategoryType,
  ): Promise<string | null> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return body?.error?.message ?? "Could not add category.";
    setCategories(body.categories);
    return null;
  }

  async function handleDelete() {
    if (!confirmTxn) return;
    const txn = confirmTxn;
    setBusy(txn.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDeleteError(body?.error?.message ?? "Could not delete this transaction.");
        return;
      }
      setDeletedIds((prev) => new Set(prev).add(txn.id));
      setConfirmTxn(null);
      router.refresh(); // resync statement totals shown elsewhere
    } catch {
      setDeleteError("Could not delete this transaction — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  const visibleTxns = txns.filter((t) => !deletedIds.has(t.id));

  return (
    <div className="overflow-x-auto">
      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Merchant</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            {allowDelete && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {visibleTxns.map((t) => (
            <tr
              key={t.id}
              className={`border-b border-zinc-100 last:border-0 ${busy === t.id ? "opacity-60" : ""}`}
            >
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{t.date}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{t.merchant}</div>
                <div className="max-w-md truncate text-xs text-zinc-500" title={t.description}>
                  {t.description}
                </div>
              </td>
              <td className="px-3 py-2">
                <CategorySelect
                  value={overrides[t.id] ?? t.category}
                  categories={categories}
                  needsReview={false}
                  onChange={(c) => handleChange(t, c)}
                  onAddCategory={handleAddCategory}
                />
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                  t.direction === "credit" ? "text-emerald-700" : "text-zinc-900"
                }`}
              >
                {t.direction === "credit" ? "+" : ""}
                {formatMoney(t.amount, t.currency)}
              </td>
              {allowDelete && (
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmTxn(t);
                    }}
                    aria-label={`Delete transaction ${t.merchant}`}
                    title="Delete transaction"
                    className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-400">
        Changing a category saves immediately and updates the merchant rule
        used for future statements.
      </p>
      {allowDelete && (
        <ConfirmModal
          open={confirmTxn !== null}
          title="Delete this transaction?"
          body={
            confirmTxn
              ? `${confirmTxn.merchant} · ${formatMoney(confirmTxn.amount, confirmTxn.currency)} on ${confirmTxn.date} will be permanently removed. This can't be undone.${deleteError ? ` — ${deleteError}` : ""}`
              : ""
          }
          confirmLabel="Delete transaction"
          busy={busy === confirmTxn?.id}
          onConfirm={handleDelete}
          onCancel={() => setConfirmTxn(null)}
        />
      )}
    </div>
  );
}
