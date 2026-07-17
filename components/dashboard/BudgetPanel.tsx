"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

interface CategoryBudget {
  name: string;
  monthly_budget: number | null;
}

/**
 * Budget vs actual with in-app editing: meters for budgeted categories, and
 * an edit mode listing every category with a per-cycle budget input.
 * The same budget applies per month and per statement cycle.
 */
export default function BudgetPanel({
  categories,
  actualByCategory,
  currency,
  monthName,
}: {
  categories: CategoryBudget[];
  actualByCategory: Record<string, number>;
  currency: string;
  monthName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    const initial: Record<string, string> = {};
    for (const c of categories) {
      initial[c.name] = c.monthly_budget ? String(c.monthly_budget) : "";
    }
    setValues(initial);
    setEditing(true);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const c of categories) {
        const raw = (values[c.name] ?? "").trim();
        const next = raw === "" ? null : Number(raw);
        if (next !== null && (!Number.isFinite(next) || next < 0)) {
          setError(`"${c.name}" needs a positive number (or leave it empty).`);
          return;
        }
        const prev = c.monthly_budget ?? null;
        if (next === prev) continue;
        const res = await fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name, monthly_budget: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? `Could not save "${c.name}".`);
          return;
        }
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const budgeted = categories
    .filter((c) => (c.monthly_budget ?? 0) > 0)
    .map((c) => ({
      category: c.name,
      budget: c.monthly_budget as number,
      actual: Math.max(actualByCategory[c.name] ?? 0, 0),
    }))
    .sort((a, b) => b.actual / b.budget - a.actual / a.budget);

  if (editing) {
    return (
      <div>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.name}
              className="flex items-center justify-between gap-3 text-sm text-zinc-700"
            >
              <span className="truncate">{c.name}</span>
              <input
                type="number"
                min="0"
                step="10"
                inputMode="decimal"
                value={values[c.name] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [c.name]: e.target.value }))
                }
                placeholder="—"
                className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-right text-sm tabular-nums focus:border-zinc-900 focus:outline-none"
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            Per cycle (month or statement) · leave empty for no budget
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save budgets"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {budgeted.length === 0 ? (
        <p className="py-2 text-sm text-zinc-500">
          No budgets set yet — add per-category budgets and they appear here,
          as the red budget line on the charts, and in Spending pace.
        </p>
      ) : (
        <div className="space-y-4">
          {budgeted.map((r) => {
            const over = r.actual > r.budget;
            const ratio = r.budget > 0 ? Math.min(r.actual / r.budget, 1) : 1;
            return (
              <div key={r.category}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-zinc-800">{r.category}</span>
                  <span className={over ? "font-medium text-red-700" : "text-zinc-500"}>
                    {over && <span aria-hidden>▲ </span>}
                    {formatMoney(r.actual, currency)} / {formatMoney(r.budget, currency)}
                    {over && (
                      <span> — over by {formatMoney(r.actual - r.budget, currency)}</span>
                    )}
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full"
                  style={{ background: chart.meterTrack }}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={r.budget}
                  aria-valuenow={r.actual}
                  aria-label={`${r.category} spend in ${monthName}`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${ratio * 100}%`,
                      background: over ? chart.critical : chart.meterFill,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 border-t border-zinc-100 pt-3 text-right">
        <button
          type="button"
          onClick={startEditing}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit budgets
        </button>
      </div>
    </div>
  );
}
