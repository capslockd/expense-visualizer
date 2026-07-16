export interface Tile {
  label: string;
  value: string;
  sub?: string;
  subTone?: "good" | "bad" | "neutral";
}

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-zinc-200 bg-white p-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{t.value}</p>
          {t.sub && (
            <p
              className={`mt-0.5 text-xs ${
                t.subTone === "good"
                  ? "text-emerald-700"
                  : t.subTone === "bad"
                    ? "text-red-700"
                    : "text-zinc-500"
              }`}
            >
              {t.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
