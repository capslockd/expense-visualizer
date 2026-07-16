"use client";

export default function DuplicateBanner({
  onDiscard,
}: {
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-orange-300 bg-orange-50 p-4">
      <div>
        <p className="text-sm font-medium text-orange-900">
          This looks like a statement you&apos;ve already uploaded
        </p>
        <p className="mt-0.5 text-sm text-orange-800">
          Same period and identical transactions. Saving it again will
          double-count these expenses — the save button below becomes
          &ldquo;Save anyway&rdquo; if you really want it.
        </p>
      </div>
      <button
        type="button"
        onClick={onDiscard}
        className="shrink-0 rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-900 hover:bg-orange-100"
      >
        Discard
      </button>
    </div>
  );
}
