"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteStatementButton({
  statementId,
  label,
  redirectTo,
}: {
  statementId: string;
  label: string;
  /** Navigate here after deleting (set on the statement page). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      `Delete the statement "${label}" and all of its transactions? Learned merchant rules are kept. This can't be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/statements/${statementId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        window.alert(body?.error?.message ?? "Could not delete the statement.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete statement"}
    </button>
  );
}

export function DeleteStatementIcon({
  statementId,
  label,
}: {
  statementId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(
      `Delete the statement "${label}" and all of its transactions? This can't be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/statements/${statementId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        window.alert(body?.error?.message ?? "Could not delete the statement.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      aria-label={`Delete statement ${label}`}
      title="Delete statement"
      className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
      </svg>
    </button>
  );
}

export function DeleteAllStatementsButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const typed = window.prompt(
      `This deletes ALL ${count} statement${count === 1 ? "" : "s"} and every transaction — your categories and learned merchant rules are kept.\n\nType DELETE to confirm:`,
    );
    if (typed !== "DELETE") return;
    setBusy(true);
    try {
      const res = await fetch("/api/statements?confirm=all", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        window.alert(body?.error?.message ?? "Could not delete statements.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="text-xs text-zinc-400 underline decoration-dotted hover:text-red-700"
    >
      {busy ? "Deleting…" : "Delete all statement data"}
    </button>
  );
}
