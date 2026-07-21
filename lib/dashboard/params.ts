export const MAX_PERIODS = 24;
export const SHOW_OPTIONS = [1, 3, 6, 12, 24] as const;

export interface DashboardParams {
  currency: string;
  group: "statement" | "month";
  show: number;
}

/**
 * Resolves the group/show/currency query params shared identically by all
 * 3 dashboards (Expense, Income, Income vs Expenditure).
 */
export function resolveDashboardParams(
  params: Record<string, string | string[] | undefined>,
  currencies: string[],
): DashboardParams {
  const requestedCurrency =
    typeof params.currency === "string" ? params.currency : null;
  const currency =
    requestedCurrency && currencies.includes(requestedCurrency)
      ? requestedCurrency
      : currencies[0];

  const group = params.group === "month" ? "month" : "statement";

  const requestedShow = Number(params.show);
  const show = (SHOW_OPTIONS as readonly number[]).includes(requestedShow)
    ? requestedShow
    : MAX_PERIODS;

  return { currency, group, show };
}
