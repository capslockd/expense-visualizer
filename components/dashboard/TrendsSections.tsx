import { CategoryType, Txn } from "@/lib/types";
import { RecurringMerchant, YearSummary } from "@/lib/analytics";
import RecurringSpendPanel from "./RecurringSpendPanel";
import YearInReviewSection from "./YearInReviewSection";
import SavingsRateExplorer from "./SavingsRateExplorer";
import TransactionExplorer from "./TransactionExplorer";
import { SavingsRatePoint } from "./SavingsRateChart";

/**
 * Composition root for the Trends Dashboard — 4 independent sections, each
 * in the standard card wrapper. Unlike DashboardSections, nothing here is
 * cross-section reactive (no shared category filter), so this component
 * itself owns no state — each section manages its own interactivity.
 */
export default function TrendsSections({
  currency,
  categoryNames,
  recurring,
  dismissedMerchants,
  expenseTxns,
  years,
  savingsRateData,
  periodNoun,
  merchantExplorerTxns,
}: {
  currency: string;
  categoryNames: { name: string; type: CategoryType }[];
  recurring: RecurringMerchant[];
  dismissedMerchants: string[];
  /** Expense-slice, full currency history — recurring detection's drill-down scope. */
  expenseTxns: Txn[];
  years: YearSummary[];
  savingsRateData: SavingsRatePoint[];
  periodNoun: string;
  /** Expense + income combined, full currency history — the explorer's search scope. */
  merchantExplorerTxns: Txn[];
}) {
  return (
    <>
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Recurring &amp; subscriptions</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Merchants billing on a regular cadence, detected from your full expense history —
          not just the visible window above.
        </p>
        <RecurringSpendPanel
          recurring={recurring}
          dismissedMerchants={dismissedMerchants}
          txns={expenseTxns}
          categories={categoryNames}
          currency={currency}
        />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Year in review</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Annual totals across your full history, most recent year first.
        </p>
        <YearInReviewSection years={years} currency={currency} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Savings rate · per {periodNoun}</h2>
        <p className="mb-4 text-xs text-zinc-500">
          The only section on this page that follows the group/show controls above — how much
          of your income you kept, over time.
        </p>
        <SavingsRateExplorer data={savingsRateData} currency={currency} periodNoun={periodNoun} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Transaction explorer</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Search every transaction in your full history by merchant, date, amount, or category.
        </p>
        <TransactionExplorer
          txns={merchantExplorerTxns}
          categories={categoryNames}
          currency={currency}
        />
      </section>
    </>
  );
}
