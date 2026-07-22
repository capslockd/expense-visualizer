import { getSheets, getSpreadsheetId } from "./client";

/** Tab definitions: tab title → header row. Column order is the storage contract. */
export const TABS: Record<string, string[]> = {
  Users: ["id", "email", "name", "password_hash", "auth_provider", "created_at"],
  Statements: [
    "id",
    "user_id",
    "uploaded_at",
    "period_start",
    "period_end",
    "source_filename",
    "currency",
    "total_debits",
    "total_credits",
    "transaction_count",
    "content_hash",
    "title",
  ],
  Transactions: [
    "id",
    "user_id",
    "statement_id",
    "date",
    "description",
    "merchant",
    "merchant_normalized",
    "amount",
    "direction",
    "currency",
    "category",
    "categorized_by",
  ],
  CategoryRules: ["user_id", "merchant_normalized", "category", "created_at"],
  Categories: ["user_id", "name", "monthly_budget", "created_at", "type", "excluded"],
  RecurringDismissals: ["user_id", "merchant_normalized", "dismissed_at"],
};

let setupPromise: Promise<void> | null = null;

/**
 * Idempotently ensure all tabs exist with header rows.
 * Memoized per server process; call freely before any read/write.
 */
export function ensureSheetSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = doSetup().catch((err) => {
      setupPromise = null; // allow retry on failure
      throw err;
    });
  }
  return setupPromise;
}

async function doSetup(): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
  );

  const missing = Object.keys(TABS).filter((t) => !existing.has(t));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  // Write header rows where A1 is empty; extend headers when the schema has
  // grown (new columns are always appended, so rewriting row 1 is safe).
  const headerCheck = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: Object.keys(TABS).map((t) => `${t}!1:1`),
  });
  const updates: { range: string; values: string[][] }[] = [];
  Object.keys(TABS).forEach((tab, i) => {
    const row = headerCheck.data.valueRanges?.[i]?.values?.[0];
    if (!row || row.length === 0 || row.length < TABS[tab].length) {
      updates.push({ range: `${tab}!A1`, values: [TABS[tab]] });
    }
  });
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
}
