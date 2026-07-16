import { chart } from "./chartTheme";
import { formatMoney } from "@/lib/analytics";

/**
 * Ratio-against-limit per category → a list of meters (same-ramp track).
 * Over budget switches the fill to the critical status color, always paired
 * with an icon + text label (never color alone).
 */
export default function BudgetVsActual({
  rows,
  currency,
  monthName,
}: {
  rows: Array<{ category: string; budget: number; actual: number }>;
  currency: string;
  monthName: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-zinc-500">
        No budgets set yet. Add a number in the{" "}
        <span className="font-medium">monthly_budget</span> column of the
        Categories tab in your Google Sheet, and this section fills in.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => {
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
  );
}
