"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { normalizeMerchant } from "@/lib/categorize/normalize";
import { CategoryType, Direction } from "@/lib/types";
import CategorySelect from "./CategorySelect";
import DuplicateBanner from "./DuplicateBanner";

interface ManualRow {
  tempId: string;
  date: string;
  description: string;
  amount: string; // raw input text while editing
  direction: Direction;
  category: string | null;
  remember: boolean;
}

const CURRENCY_OPTIONS = [
  "AUD", "NZD", "USD", "GBP", "EUR", "SGD", "PHP", "JPY", "HKD", "MYR", "IDR", "INR",
];

function newRow(): ManualRow {
  return {
    tempId: crypto.randomUUID(),
    date: "",
    description: "",
    amount: "",
    direction: "debit",
    category: null,
    remember: true,
  };
}

function parsedAmount(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function isComplete(row: ManualRow): boolean {
  return (
    row.date !== "" &&
    row.description.trim() !== "" &&
    parsedAmount(row.amount) !== null &&
    row.category !== null
  );
}

type Flow = "editing" | "saving" | { step: "saved"; statementId: string };

/**
 * Hand-entered alternative to file upload: build a small statement row by
 * row. Every row still needs a real category before it can save — the same
 * hard requirement the upload review flow enforces, just satisfied at entry
 * time instead of via AI/keyword review.
 */
export default function ManualEntryFlow({
  initialCategories,
}: {
  initialCategories: { name: string; type: CategoryType }[];
}) {
  const [flow, setFlow] = useState<Flow>("editing");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [categories, setCategories] = useState(initialCategories);
  const [rows, setRows] = useState<ManualRow[]>([newRow()]);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incompleteCount = useMemo(
    () => rows.filter((r) => !isComplete(r)).length,
    [rows],
  );

  function updateRow(tempId: string, patch: Partial<ManualRow>) {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
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

  function reset() {
    setTitle("");
    setRows([newRow()]);
    setDuplicate(false);
    setError(null);
    setFlow("editing");
  }

  async function handleSave() {
    if (incompleteCount > 0 || rows.length === 0) return;
    setError(null);
    setFlow("saving");
    try {
      const dates = [...rows.map((r) => r.date)].sort();
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: {
            period_start: dates[0] ?? null,
            period_end: dates[dates.length - 1] ?? null,
            currency,
            source_filename: "Manual entry",
            title: title.trim(),
          },
          transactions: rows.map((r) => {
            const description = r.description.trim();
            return {
              tempId: r.tempId,
              date: r.date,
              description,
              merchant: description,
              merchant_normalized: normalizeMerchant(description),
              amount: parsedAmount(r.amount) ?? 0,
              direction: r.direction,
              currency,
              category: r.category as string,
              categorized_by: "user",
              remember: r.remember,
              ai_proposal: null,
            };
          }),
          allowDuplicate: duplicate,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        setDuplicate(true);
        setError(
          body?.error?.message ??
            "This looks like a duplicate. Use “Save anyway” if that's expected.",
        );
        setFlow("editing");
        return;
      }
      if (!res.ok) {
        setError(body?.error?.message ?? "Saving failed. Try again.");
        setFlow("editing");
        return;
      }
      setFlow({ step: "saved", statementId: body.statement_id });
    } catch {
      setError("Saving failed — check your connection and try again.");
      setFlow("editing");
    }
  }

  if (typeof flow === "object" && flow.step === "saved") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-900">Statement saved 🎉</p>
        <p className="mt-1 text-sm text-emerald-800">
          Every transaction is categorized and recorded in your sheet.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href={`/dashboard/statements/${flow.statementId}`}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            View breakdown
          </Link>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            Add more
          </button>
        </div>
      </div>
    );
  }

  const saving = flow === "saving";

  return (
    <div className="space-y-4 pb-24">
      {duplicate && <DuplicateBanner onDiscard={() => setDuplicate(false)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={`Name this statement… (e.g. "July cash expenses")`}
            aria-label="Statement name (optional)"
            className="w-full max-w-md rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold text-zinc-900 placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-900 focus:bg-white focus:outline-none"
          />
          <p className="flex items-center gap-1.5 px-1 text-sm text-zinc-500">
            {rows.length} row{rows.length === 1 ? "" : "s"} ·
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Statement currency"
              className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-700 focus:border-zinc-900 focus:outline-none"
            >
              {[...new Set([currency, ...CURRENCY_OPTIONS])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Money out / in</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Remember</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const complete = isComplete(row);
              return (
                <tr
                  key={row.tempId}
                  className={`border-b border-zinc-100 last:border-0 ${!complete ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-2.5 align-top">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(row.tempId, { date: e.target.value })}
                      className="w-36 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.tempId, { description: e.target.value })
                      }
                      placeholder="e.g. Coles, Salary, Rent"
                      className="w-full min-w-44 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 rounded-md border border-zinc-300 p-0.5 text-xs">
                        {(
                          [
                            ["debit", "Out"],
                            ["credit", "In"],
                          ] as const
                        ).map(([d, label]) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => updateRow(row.tempId, { direction: d })}
                            className={`rounded px-2 py-1 ${
                              row.direction === d
                                ? d === "debit"
                                  ? "bg-zinc-900 font-medium text-white"
                                  : "bg-emerald-700 font-medium text-white"
                                : "text-zinc-600 hover:bg-zinc-100"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(e) => updateRow(row.tempId, { amount: e.target.value })}
                        placeholder="0.00"
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm tabular-nums focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <CategorySelect
                      value={row.category}
                      categories={categories}
                      needsReview={!row.category}
                      onChange={(c) => updateRow(row.tempId, { category: c })}
                      onAddCategory={handleAddCategory}
                    />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={row.remember}
                        onChange={(e) =>
                          updateRow(row.tempId, { remember: e.target.checked })
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300"
                      />
                      this merchant
                    </label>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(row.tempId)}
                      aria-label="Remove row"
                      className="rounded-md px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-zinc-100 p-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ＋ Add row
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {rows.length === 0 ? (
            <p className="text-sm font-medium text-zinc-500">Add at least one row.</p>
          ) : incompleteCount > 0 ? (
            <p className="text-sm font-medium text-amber-700">
              {incompleteCount} row{incompleteCount === 1 ? "" : "s"} still need
              {incompleteCount === 1 ? "s" : ""} a date, description, amount, and
              category — nothing can stay uncategorized.
            </p>
          ) : (
            <p className="text-sm font-medium text-emerald-700">
              All {rows.length} row{rows.length === 1 ? "" : "s"} ready ✓
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={incompleteCount > 0 || rows.length === 0 || saving}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : duplicate ? "Save anyway" : "Save statement"}
          </button>
        </div>
      </div>
    </div>
  );
}
