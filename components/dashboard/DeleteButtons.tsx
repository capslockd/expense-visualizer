"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

function useDeleteStatement(statementId: string, redirectTo?: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(onDone: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/statements/${statementId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Could not delete the statement.");
        return;
      }
      onDone();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function DeleteStatementButton({
  statementId,
  label,
  redirectTo,
}: {
  statementId: string;
  label: string;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useDeleteStatement(statementId, redirectTo);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete statement
      </button>
      <ConfirmModal
        open={open}
        title="Delete this statement?"
        body={`"${label}" and all of its transactions will be removed. Your learned merchant rules and categories are kept. This can't be undone.${error ? ` — ${error}` : ""}`}
        confirmLabel="Delete statement"
        busy={busy}
        onConfirm={() => run(() => setOpen(false))}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function DeleteStatementIcon({
  statementId,
  label,
}: {
  statementId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useDeleteStatement(statementId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete statement ${label}`}
        title="Delete statement"
        className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-700"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
        </svg>
      </button>
      <ConfirmModal
        open={open}
        title="Delete this statement?"
        body={`"${label}" and all of its transactions will be removed. Your learned merchant rules and categories are kept. This can't be undone.${error ? ` — ${error}` : ""}`}
        confirmLabel="Delete statement"
        busy={busy}
        onConfirm={() => run(() => setOpen(false))}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function DeleteAllStatementsButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/statements?confirm=all", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Could not delete statements.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-400 underline decoration-dotted hover:text-red-700"
      >
        Delete all statement data
      </button>
      <ConfirmModal
        open={open}
        title={`Delete all ${count} statement${count === 1 ? "" : "s"}?`}
        body={`Every statement and every transaction will be removed. Your categories and learned merchant rules are kept.${error ? ` — ${error}` : ""}`}
        confirmLabel="Delete everything"
        typedPhrase="DELETE"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
