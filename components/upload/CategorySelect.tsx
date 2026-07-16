"use client";

import { useState } from "react";

const ADD_NEW = "__add_new__";

export default function CategorySelect({
  value,
  categories,
  needsReview,
  onChange,
  onAddCategory,
}: {
  value: string | null;
  categories: string[];
  needsReview: boolean;
  onChange: (category: string) => void;
  onAddCategory: (name: string) => Promise<string | null>; // returns error message or null
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitNew() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const err = await onAddCategory(name);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onChange(name);
    setAdding(false);
    setNewName("");
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNew();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="New category…"
            className="w-36 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={busy || !newName.trim()}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>
        {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
        } else if (e.target.value) {
          onChange(e.target.value);
        }
      }}
      className={`w-44 rounded-md border px-2 py-1.5 text-sm focus:outline-none ${
        needsReview && !value
          ? "border-amber-400 bg-amber-50 text-amber-900"
          : "border-zinc-300 bg-white text-zinc-800"
      }`}
    >
      <option value="" disabled>
        Choose category…
      </option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={ADD_NEW}>＋ Add new category…</option>
    </select>
  );
}
