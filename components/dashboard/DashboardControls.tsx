import Link from "next/link";
import { SHOW_OPTIONS } from "@/lib/dashboard/params";

/**
 * The group (statement/month), show-window (1/3/6/12/24), and currency
 * toggle bar shared by all 3 dashboards — pure navigation (Link-based), no
 * client state, so it stays a server component.
 */
export default function DashboardControls({
  basePath,
  group,
  show,
  currency,
  currencies,
  periodNoun,
}: {
  basePath: string;
  group: "statement" | "month";
  show: number;
  currency: string;
  currencies: string[];
  periodNoun: string;
}) {
  const href = (over: { group?: string; show?: number; currency?: string }) => {
    const q = new URLSearchParams();
    q.set("group", over.group ?? group);
    q.set("show", String(over.show ?? show));
    if (currencies.length > 1) q.set("currency", over.currency ?? currency);
    return `${basePath}?${q.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
        {(
          [
            ["statement", "By statement"],
            ["month", "By month"],
          ] as const
        ).map(([g, label]) => (
          <Link
            key={g}
            href={href({ group: g })}
            className={`rounded-md px-3 py-1 text-sm ${
              g === group
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
        {SHOW_OPTIONS.map((n) => (
          <Link
            key={n}
            href={href({ show: n })}
            title={`Show the last ${n} ${periodNoun}s`}
            className={`rounded-md px-3 py-1 text-sm ${
              n === show
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {n}
          </Link>
        ))}
      </div>

      {currencies.length > 1 && (
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          {currencies.map((c) => (
            <Link
              key={c}
              href={href({ currency: c })}
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
  );
}
