import Link from "next/link";

const TABS = [
  { key: "statements", label: "Statements", href: "/dashboard/statements" },
  { key: "budgets", label: "Budgets", href: "/dashboard/budgets" },
] as const;

/** Tab strip shown at the top of the 2 "input" pages for quick lateral navigation. */
export default function ManageTabs({
  active,
}: {
  active: "statements" | "budgets";
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
