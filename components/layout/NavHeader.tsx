"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavItem {
  href: string;
  label: string;
}

const DASHBOARD_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Expense Dashboard" },
  { href: "/dashboard/income", label: "Income Dashboard" },
  { href: "/dashboard/income-vs-expense", label: "Income vs Expenditure" },
];

const MANAGE_ITEMS: NavItem[] = [
  { href: "/dashboard/statements", label: "Statements" },
  { href: "/dashboard/budgets", label: "Budgets" },
];

function isActiveHref(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Statement detail pages belong to the Statements list, not a bare "/dashboard" match.
  if (href === "/dashboard/statements" && pathname.startsWith("/dashboard/statements/")) {
    return true;
  }
  return false;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A labeled group of nav links revealed on click — closes on outside click, Escape, or navigation. */
function NavDropdown({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((i) => isActiveHref(pathname, i.href));

  // Close on navigation (e.g. browser back/forward, or any other link) —
  // adjusted during render rather than an effect, per React's guidance for
  // resetting state from a prop change.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 text-sm ${
          active ? "font-medium text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
        }`}
      >
        {label}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm ${
                isActiveHref(pathname, item.href)
                  ? "bg-zinc-50 font-medium text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Global nav — a client component so the active section/dropdown can be highlighted via the current path. */
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
          <NavDropdown label="Dashboards" items={DASHBOARD_ITEMS} pathname={pathname} />
          <NavDropdown label="Manage" items={MANAGE_ITEMS} pathname={pathname} />
          <Link
            href="/upload"
            className={`text-sm ${
              isActiveHref(pathname, "/upload")
                ? "font-medium text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Upload
          </Link>
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
