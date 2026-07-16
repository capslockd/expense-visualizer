/**
 * Chart tokens — the dataviz reference palette (light mode), validated with
 * scripts/validate_palette.js against surface #fcfcfb:
 * adjacent CVD ΔE 9.1, normal-vision ΔE 19.6 — PASS. Three slots sit below
 * 3:1 contrast, so every chart pairs marks with visible labels or a table.
 */
export const chart = {
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  inkSecondary: "#52514e",
  inkMuted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",

  /** Emphasis form: the one series that matters + recessive context. */
  accent: "#2a78d6",
  deemphasis: "#c3c2b7",

  /** Categorical slots, fixed order — assigned to categories by all-time rank, never cycled. */
  slots: ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834"],
  /** Visual fold for the small remainder ("Other categories") — a rollup, not a data category. */
  fold: "#898781",

  /** Meter (budget) — same-ramp track + fill; status color only for the over-budget state. */
  meterTrack: "#cde2fb",
  meterFill: "#2a78d6",
  critical: "#d03b3b",
  good: "#006300",
} as const;

/** Stable category → color assignment shared by all charts on a page. */
export function assignSlots(rankedCategories: string[]): Map<string, string> {
  const map = new Map<string, string>();
  rankedCategories.slice(0, chart.slots.length).forEach((c, i) => {
    map.set(c, chart.slots[i]);
  });
  return map;
}
