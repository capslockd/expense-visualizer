"use client";

import { CategoryType } from "@/lib/types";
import CategorySelect from "./CategorySelect";
import type { ReviewRow } from "./UploadFlow";

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ReviewTable({
  rows,
  categories,
  onCategoryChange,
  onRememberChange,
  onAddCategory,
}: {
  rows: ReviewRow[];
  categories: { name: string; type: CategoryType }[];
  onCategoryChange: (tempId: string, category: string) => void;
  onRememberChange: (tempId: string, remember: boolean) => void;
  onAddCategory: (name: string, type: CategoryType) => Promise<string | null>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Merchant</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Remember</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const unresolved = !row.category;
            const userDecided =
              row.ai_proposal === null || row.category !== row.ai_proposal;
            return (
              <tr
                key={row.tempId}
                className={`border-b border-zinc-100 last:border-0 ${
                  unresolved ? "bg-amber-50" : ""
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3 align-top text-zinc-600">
                  {row.date}
                </td>
                <td className="max-w-72 px-4 py-3 align-top">
                  <div className="font-medium text-zinc-900">{row.merchant}</div>
                  <div
                    className="truncate text-xs text-zinc-500"
                    title={row.description}
                  >
                    {row.description}
                  </div>
                  {unresolved && row.confidence_note && (
                    <div className="mt-1 text-xs font-medium text-amber-700">
                      Needs your input: {row.confidence_note}
                    </div>
                  )}
                  {unresolved && !row.confidence_note && (
                    <div className="mt-1 text-xs font-medium text-amber-700">
                      Needs your input — the AI wasn&apos;t sure.
                    </div>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right align-top tabular-nums ${
                    row.direction === "credit"
                      ? "text-emerald-700"
                      : "text-zinc-900"
                  }`}
                >
                  {row.direction === "credit" ? "+" : ""}
                  {formatAmount(row.amount, row.currency)}
                </td>
                <td className="px-4 py-3 align-top">
                  <CategorySelect
                    value={row.category}
                    categories={categories}
                    needsReview={unresolved}
                    onChange={(c) => onCategoryChange(row.tempId, c)}
                    onAddCategory={onAddCategory}
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  {userDecided && row.category ? (
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={row.remember}
                        onChange={(e) =>
                          onRememberChange(row.tempId, e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300"
                      />
                      this merchant
                    </label>
                  ) : (
                    <span className="text-xs text-zinc-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
