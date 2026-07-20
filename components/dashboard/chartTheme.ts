/**
 * Chart tokens — the dataviz reference palette (light mode) extended to 16
 * categorical slots so every category renders individually (no "Other" fold
 * up to 16). Validated with scripts/validate_palette.js against surface
 * #fcfcfb: lightness band PASS, chroma PASS, normal-vision floor ΔE 17.8
 * PASS; worst adjacent CVD pair ΔE 7.4 sits in the legal 6–8 band, covered
 * by secondary encoding (legend always present, 2px surface gaps between
 * stacked segments, direct labels/tooltips). Low-contrast slots rely on the
 * relief rule: visible labels + table views accompany every chart.
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
  slots: [
    "#2a78d6", "#008300", "#e87ba4", "#eda100",
    "#1baf7a", "#eb6834", "#4a3aa7", "#e34948",
    "#0e7f9e", "#7a8a00", "#b0426e", "#a87400",
    "#0e7a55", "#a34a1f", "#9085e9", "#9c2b2b",
  ],
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
