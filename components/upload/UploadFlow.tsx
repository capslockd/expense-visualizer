"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExtractedStatement, ExtractedTxn } from "@/lib/types";
import Dropzone from "./Dropzone";
import ReviewTable from "./ReviewTable";
import DuplicateBanner from "./DuplicateBanner";

export type ReviewRow = ExtractedTxn & {
  remember: boolean;
  /** Extract-time category (null = AI couldn't decide) — echoed to the server for rule learning. */
  ai_proposal: string | null;
};

type Flow =
  | { step: "idle" }
  | { step: "extracting"; filename: string }
  | { step: "review" }
  | { step: "saving" }
  | { step: "saved"; statementId: string };

export default function UploadFlow() {
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<ExtractedStatement | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState(false);

  const unresolvedCount = useMemo(
    () => rows.filter((r) => !r.category).length,
    [rows],
  );

  function reset() {
    setFlow({ step: "idle" });
    setError(null);
    setStatement(null);
    setWarnings([]);
    setRows([]);
    setDuplicate(false);
  }

  async function handleFile(file: File) {
    setError(null);
    setFlow({ step: "extracting", filename: file.name });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Extraction failed. Try again.");
        setFlow({ step: "idle" });
        return;
      }

      const txns: ExtractedTxn[] = body.transactions;
      if (txns.length === 0) {
        setError(
          "No transactions were found in this file. Check that it's a statement with line items.",
        );
        setFlow({ step: "idle" });
        return;
      }

      // Needs-review rows first, then chronological — order fixed at entry so
      // rows don't jump around while the user works through them.
      const sorted = [...txns].sort((a, b) => {
        if (a.needs_review !== b.needs_review) return a.needs_review ? -1 : 1;
        return a.date.localeCompare(b.date);
      });

      setStatement(body.statement);
      setWarnings(body.warnings ?? []);
      setCategories(body.categories ?? []);
      setDuplicate(Boolean(body.statement?.duplicate_of));
      setRows(
        sorted.map((t) => ({ ...t, remember: true, ai_proposal: t.category })),
      );
      setFlow({ step: "review" });
    } catch {
      setError("Upload failed — check your connection and try again.");
      setFlow({ step: "idle" });
    }
  }

  function handleCategoryChange(tempId: string, category: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, category, needs_review: false } : r,
      ),
    );
  }

  function handleRememberChange(tempId: string, remember: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, remember } : r)),
    );
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

  async function handleSave() {
    if (!statement || unresolvedCount > 0) return;
    setError(null);
    setFlow({ step: "saving" });
    try {
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: {
            period_start: statement.period_start,
            period_end: statement.period_end,
            currency: statement.currency,
            source_filename: statement.source_filename,
            content_hash: statement.content_hash,
          },
          transactions: rows.map((r) => ({
            tempId: r.tempId,
            date: r.date,
            description: r.description,
            merchant: r.merchant,
            merchant_normalized: r.merchant_normalized,
            amount: r.amount,
            direction: r.direction,
            currency: r.currency,
            category: r.category as string,
            categorized_by:
              r.ai_proposal === null || r.category !== r.ai_proposal
                ? "user"
                : r.categorized_by,
            remember: r.remember,
            ai_proposal: r.ai_proposal,
          })),
          allowDuplicate: duplicate,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        setDuplicate(true);
        setError(
          body?.error?.message ??
            "This statement was already saved. Use “Save anyway” to keep both.",
        );
        setFlow({ step: "review" });
        return;
      }
      if (!res.ok) {
        setError(body?.error?.message ?? "Saving failed. Try again.");
        setFlow({ step: "review" });
        return;
      }
      setFlow({ step: "saved", statementId: body.statement_id });
    } catch {
      setError("Saving failed — check your connection and try again.");
      setFlow({ step: "review" });
    }
  }

  // ---------------------------------------------------------------- render

  if (flow.step === "idle" || flow.step === "extracting") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        <Dropzone onFile={handleFile} disabled={flow.step === "extracting"} />
        {flow.step === "extracting" && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            <div className="text-sm text-zinc-700">
              Reading <span className="font-medium">{flow.filename}</span> and
              categorizing every transaction… this can take a minute for long
              statements.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (flow.step === "saved") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-900">
          Statement saved 🎉
        </p>
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
            Upload another
          </button>
        </div>
      </div>
    );
  }

  // review / saving
  const saving = flow.step === "saving";
  return (
    <div className="space-y-4 pb-24">
      {duplicate && <DuplicateBanner onDiscard={reset} />}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-medium">Notes from the parser</p>
          <ul className="mt-1 list-inside list-disc">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {statement?.source_filename}
          </h2>
          <p className="text-sm text-zinc-500">
            {statement?.period_start && statement?.period_end
              ? `${statement.period_start} → ${statement.period_end} · `
              : ""}
            {rows.length} transactions · {statement?.currency}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Start over
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <ReviewTable
        rows={rows}
        categories={categories}
        onCategoryChange={handleCategoryChange}
        onRememberChange={handleRememberChange}
        onAddCategory={handleAddCategory}
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {unresolvedCount > 0 ? (
            <p className="text-sm font-medium text-amber-700">
              {unresolvedCount} transaction{unresolvedCount === 1 ? "" : "s"}{" "}
              still need{unresolvedCount === 1 ? "s" : ""} a category — nothing
              can stay uncategorized.
            </p>
          ) : (
            <p className="text-sm font-medium text-emerald-700">
              All {rows.length} transactions categorized ✓
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={unresolvedCount > 0 || saving}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : duplicate ? "Save anyway" : "Save statement"}
          </button>
        </div>
      </div>
    </div>
  );
}
