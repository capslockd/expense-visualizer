import Link from "next/link";

const TABS = [
  { key: "expense", label: "Expense Dashboard", href: "/dashboard" },
  { key: "income", label: "Income Dashboard", href: "/dashboard/income" },
  {
    key: "overview",
    label: "Income vs Expenditure",
    href: "/dashboard/income-vs-expense",
  },
] as const;

/** Tab strip shown at the top of all 3 dashboard pages for quick lateral navigation. */
export default function DashboardTabs({
  active,
}: {
  active: "expense" | "income" | "overview";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-md px-3 py-1.5 text-sm ${
            t.key === active
              ? "bg-zinc-900 font-medium text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
