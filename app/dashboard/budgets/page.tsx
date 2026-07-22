import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories, getStatements, getTransactions } from "@/lib/sheets/repo";
import { byMonth, currenciesOf, monthLabel, partitionByType } from "@/lib/analytics";
import ManageTabs from "@/components/dashboard/ManageTabs";
import BudgetPanel from "@/components/dashboard/BudgetPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Budgets — Expense Visualizer" };

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard/budgets");
  const userId = session.user.id;

  const [allTxns, statements, categories] = await Promise.all([
    getTransactions(userId),
    getStatements(userId),
    getCategories(userId),
  ]);

  if (statements.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">No statements yet</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Upload a statement first — budgets compare against actual spend,
          so there&apos;s nothing to show until some expenses exist.
        </p>
        <Link
          href="/upload"
          className="mt-6 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Upload a statement
        </Link>
      </main>
    );
  }

  const params = await searchParams;
  const currencies = currenciesOf(allTxns);
  const requestedCurrency = typeof params.currency === "string" ? params.currency : null;
  const currency =
    requestedCurrency && currencies.includes(requestedCurrency)
      ? requestedCurrency
      : currencies[0];
  const currencyTxns = allTxns.filter((t) => t.currency === currency);

  const incomeCategoryNames = new Set(
    categories.filter((c) => c.type === "income").map((c) => c.name),
  );
  const excludedCategoryNames = new Set(
    categories.filter((c) => c.excluded).map((c) => c.name),
  );
  const { expense: expenseTxns } = partitionByType(
    currencyTxns,
    incomeCategoryNames,
    excludedCategoryNames,
  );

  // Budgets compare against the latest calendar month.
  const monthly = byMonth(expenseTxns);
  const latestMonth = monthly[monthly.length - 1];
  const latestMonthName = latestMonth ? monthLabel(latestMonth.key) : "";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <ManageTabs active="budgets" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        {currencies.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            {currencies.map((c) => (
              <Link
                key={c}
                href={`/dashboard/budgets?currency=${c}`}
                className={`rounded-md px-3 py-1 text-sm ${
                  c === currency
                    ? "bg-zinc-900 font-medium text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          Budget vs actual{latestMonthName ? ` · ${latestMonthName}` : ""}
          <span className="ml-1 font-normal text-zinc-400">
            (per cycle — month or statement)
          </span>
        </h2>
        <div className="mt-4">
          <BudgetPanel
            categories={categories
              .filter((c) => c.type === "expense")
              .map((c) => ({
                name: c.name,
                monthly_budget: c.monthly_budget,
              }))}
            actualByCategory={latestMonth?.byCategory ?? {}}
            currency={currency}
            monthName={latestMonthName}
          />
        </div>
      </section>
    </main>
  );
}
