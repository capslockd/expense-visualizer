"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Txn } from "@/lib/types";
import { formatMoney } from "@/lib/analytics";
import CategorySelect from "@/components/upload/CategorySelect";

/**
 * Transaction table with inline re-categorization. Changing a category saves
 * immediately (and updates the learned merchant rule for future statements).
 */
export default function EditableTxnTable({
  txns,
  categories: initialCategories,
}: {
  txns: Txn[];
  categories: string[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic overrides so the dropdown reflects the change instantly.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

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

  async function handleAddCategory(name: string): Promise<string | null> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return body?.error?.message ?? "Could not add category.";
    setCategories(body.categories);
    return null;
  }

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
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
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
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-400">
        Changing a category saves immediately and updates the merchant rule
        used for future statements.
      </p>
    </div>
  );
}
