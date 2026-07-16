import { Txn } from "@/lib/types";
import { formatMoney } from "@/lib/analytics";

export default function TxnTable({ txns }: { txns: Txn[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Merchant</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{t.date}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{t.merchant}</div>
                <div className="max-w-md truncate text-xs text-zinc-500" title={t.description}>
                  {t.description}
                </div>
              </td>
              <td className="px-3 py-2">
                <span className="inline-block rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">
                  {t.category}
                </span>
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                  t.direction === "credit" ? "text-emerald-700" : "text-zinc-900"
                }`}
              >
                {t.direction === "credit" ? "+" : ""}
                {formatMoney(t.amount, t.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
