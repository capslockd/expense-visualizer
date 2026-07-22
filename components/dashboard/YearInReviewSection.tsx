import { formatMoney, YearSummary } from "@/lib/analytics";
import StatTiles, { Tile } from "./StatTiles";

/**
 * One card per calendar year (already sorted most-recent-first by
 * yearInReview) — headline stat tiles plus a ranked top-categories list.
 * Degrades to a single card when only one year of data exists.
 */
export default function YearInReviewSection({
  years,
  currency,
}: {
  years: YearSummary[];
  currency: string;
}) {
  if (years.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No activity yet — upload a statement to see your yearly summary.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {years.map((y) => {
        const tiles: Tile[] = [
          { label: "Total income", value: formatMoney(y.totalIncome, currency) },
          { label: "Total expenses", value: formatMoney(y.totalExpense, currency) },
          {
            label: y.netSaved < 0 ? "Net shortfall" : "Net saved",
            value: `${y.netSaved < 0 ? "−" : ""}${formatMoney(Math.abs(y.netSaved), currency)}`,
            subTone: y.netSaved < 0 ? "bad" : "good",
          },
          {
            label: "Top merchant",
            value: y.topMerchant?.merchant ?? "—",
            sub: y.topMerchant ? formatMoney(y.topMerchant.total, currency) : "no spending",
          },
          {
            label: "Busiest month",
            value: y.busiestMonth?.label ?? "—",
            sub: y.busiestMonth ? formatMoney(y.busiestMonth.total, currency) : undefined,
          },
          {
            label: "Biggest expense",
            value: y.biggestExpense ? formatMoney(y.biggestExpense.amount, currency) : "—",
            sub: y.biggestExpense
              ? `${y.biggestExpense.merchant} · ${y.biggestExpense.date}`
              : "no purchases",
          },
        ];

        return (
          <div
            key={y.year}
            className={
              years.length > 1 ? "border-b border-zinc-100 pb-6 last:border-0 last:pb-0" : ""
            }
          >
            <h3 className="mb-3 text-base font-semibold text-zinc-900">{y.year}</h3>
            <StatTiles tiles={tiles} />
            {y.topCategories.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold text-zinc-700">Top categories</h4>
                <ol className="space-y-1.5">
                  {y.topCategories.map((c, i) => (
                    <li
                      key={c.category}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-1.5"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                          i === 0 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                        {c.category}
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-zinc-900">
                        {formatMoney(c.total, currency)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
