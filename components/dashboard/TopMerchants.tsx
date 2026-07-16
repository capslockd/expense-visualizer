import { formatMoney } from "@/lib/analytics";

export default function TopMerchants({
  rows,
  currency,
}: {
  rows: Array<{ merchant: string; total: number; count: number }>;
  currency: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-zinc-500">No merchants yet.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
          <th className="py-2 font-medium">Merchant</th>
          <th className="py-2 text-right font-medium">Txns</th>
          <th className="py-2 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.merchant} className="border-b border-zinc-100 last:border-0">
            <td className="max-w-44 truncate py-2 text-zinc-800" title={r.merchant}>
              {r.merchant}
            </td>
            <td className="py-2 text-right tabular-nums text-zinc-500">{r.count}</td>
            <td className="py-2 text-right tabular-nums font-medium text-zinc-900">
              {formatMoney(r.total, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
