"use client";

import { useEffect, useRef, useState } from "react";

/**
 * In-page confirmation dialog for destructive actions. Optionally requires
 * typing a phrase (e.g. DELETE) before the confirm button arms.
 */
export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  typedPhrase,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** When set, the user must type this exact phrase to enable confirm. */
  typedPhrase?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      // Focus the input (or the confirm button) when the dialog opens.
      setTimeout(() => (typedPhrase ? inputRef : confirmRef).current?.focus(), 0);
    }
  }, [open, typedPhrase]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const armed = !typedPhrase || typed === typedPhrase;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-zinc-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{body}</p>
          </div>
        </div>

        {typedPhrase && (
          <label className="mt-4 block text-xs font-medium text-zinc-600">
            Type <span className="font-mono font-bold text-zinc-900">{typedPhrase}</span> to confirm
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && armed && !busy) onConfirm();
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-red-600 focus:outline-none"
            />
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={!armed || busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
