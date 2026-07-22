"use client";

import { useMemo, useState } from "react";
import { CategoryType, Txn } from "@/lib/types";
import EditableTxnTable from "./EditableTxnTable";

const MAX_ROWS = 50;

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none";

/**
 * Free-form search across ALL of a currency's transaction history (not the
 * page's show-windowed subset) — merchant/description text, date range,
 * amount range, and category. Filter state is local, not URL-driven, same as
 * the category chips on DashboardInteractive.
 */
export default function TransactionExplorer({
  txns,
  categories,
  currency,
}: {
  /** Expense + income combined, excluded already dropped, one currency's full history. */
  txns: Txn[];
  categories: { name: string; type: CategoryType }[];
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string> | null>(null);

  const presentCategories = useMemo(
    () => [...new Set(txns.map((t) => t.category))].sort((a, b) => a.localeCompare(b)),
    [txns],
  );

  function toggleCategory(category: string) {
    setCategoryFilter((prev) => {
      if (prev === null) return new Set([category]);
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next.size === 0 || next.size === presentCategories.length ? null : next;
    });
  }

  const hasFilters =
    query.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    amountMin !== "" ||
    amountMax !== "" ||
    categoryFilter !== null;

  function clearFilters() {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setCategoryFilter(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin === "" ? null : Number(amountMin);
    const max = amountMax === "" ? null : Number(amountMax);
    return txns
      .filter((t) => {
        if (
          q &&
          !t.merchant.toLowerCase().includes(q) &&
          !t.description.toLowerCase().includes(q)
        ) {
          return false;
        }
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        if (min !== null && Number.isFinite(min) && t.amount < min) return false;
        if (max !== null && Number.isFinite(max) && t.amount > max) return false;
        if (categoryFilter && !categoryFilter.has(t.category)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txns, query, dateFrom, dateTo, amountMin, amountMax, categoryFilter]);

  const capped = filtered.slice(0, MAX_ROWS);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Merchant or description
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Woolworths"
            className={`w-48 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Min amount ({currency})
          <input
            type="number"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder="0"
            className={`w-24 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Max amount ({currency})
          <input
            type="number"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder="Any"
            className={`w-24 ${inputClass}`}
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mb-1.5 text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {presentCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Categories:</span>
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              categoryFilter === null
                ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            All
          </button>
          {presentCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                categoryFilter?.has(c)
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        {filtered.length === txns.length
          ? `${txns.length} transaction${txns.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${txns.length} transactions match`}
      </p>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No transactions match these filters.
        </p>
      ) : (
        <div className="mt-2">
          <EditableTxnTable txns={capped} categories={categories} />
          {filtered.length > capped.length && (
            <p className="mt-2 text-xs text-zinc-400">
              +{filtered.length - capped.length} not shown — narrow your filters to see more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
