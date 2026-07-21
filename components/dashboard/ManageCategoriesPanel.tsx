"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryType } from "@/lib/types";

interface CategoryRow {
  name: string;
  type: CategoryType;
  excluded: boolean;
}

/**
 * Lists every category (expense and income) with an "excluded" toggle.
 * Excluded categories — card payments, ATM withdrawals, internal transfers,
 * and the like — are hidden from the Expense, Income, and Income vs
 * Expenditure dashboards entirely, not just netted to zero.
 */
export default function ManageCategoriesPanel({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    const initial: Record<string, boolean> = {};
    for (const c of categories) initial[c.name] = c.excluded;
    setValues(initial);
    setEditing(true);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const c of categories) {
        const next = values[c.name] ?? false;
        if (next === c.excluded) continue;
        const res = await fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name, excluded: next }),
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

  const excluded = categories.filter((c) => c.excluded);

  if (editing) {
    return (
      <div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.name}
              className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="truncate">
                {c.name}
                <span className="ml-1.5 text-xs text-zinc-400">
                  {c.type === "income" ? "Income" : "Expense"}
                </span>
              </span>
              <input
                type="checkbox"
                checked={values[c.name] ?? false}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [c.name]: e.target.checked }))
                }
                className="h-4 w-4 shrink-0 rounded border-zinc-300"
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            Checked = excluded from every dashboard entirely
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
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {excluded.length === 0 ? (
        <p className="py-2 text-sm text-zinc-500">
          Nothing excluded — every category counts toward Expense, Income, or
          Income vs Expenditure.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {excluded.map((c) => (
            <span
              key={c.name}
              className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600"
            >
              {c.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-zinc-100 pt-3 text-right">
        <button
          type="button"
          onClick={startEditing}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit excluded categories
        </button>
      </div>
    </div>
  );
}
