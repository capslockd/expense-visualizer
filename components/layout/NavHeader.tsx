"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Expense Dashboard" },
  { href: "/dashboard/income", label: "Income Dashboard" },
  { href: "/dashboard/income-vs-expense", label: "Income vs Expenditure" },
  { href: "/upload", label: "Upload" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Statement detail pages are reached from, and belong to, the Expense Dashboard.
  if (href === "/dashboard" && pathname.startsWith("/dashboard/statements")) return true;
  return false;
}

/** Global nav — a client component so the active dashboard link can be highlighted via the current path. */
export default function NavHeader({
  userEmail,
  signOutAction,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold">
            Expense Visualizer
          </Link>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm ${
                isActive(pathname, l.href)
                  ? "font-medium text-zinc-900"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-500 sm:inline">{userEmail}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
