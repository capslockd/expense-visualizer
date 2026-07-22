import crypto from "node:crypto";
import { getSheets, getSpreadsheetId } from "./client";
import { ensureSheetSetup, TABS } from "./bootstrap";
import {
  AuthProvider,
  Category,
  CategoryRule,
  CategorizedBy,
  CategoryType,
  DEFAULT_CATEGORIES,
  Direction,
  Statement,
  Txn,
  User,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

type Cell = string | number | boolean | null | undefined;

function asString(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function asNumber(v: Cell): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type TabRow = { rowNumber: number; cells: Record<string, Cell> };

/**
 * Every readTab() call fetches the WHOLE tab (every user's rows) — callers
 * filter by user_id afterward — so a read is identical no matter which user
 * triggered it. That makes a tab-name-keyed cache effective across
 * concurrent users, not just repeat calls within one request: two different
 * users loading a dashboard within the same TTL window share one Sheets API
 * read instead of issuing two. TTL is a safety net for edits made directly
 * in the spreadsheet outside the app; anything written through this module
 * invalidates immediately via invalidateTab(), so a user's own action is
 * never stale.
 */
const TAB_CACHE_TTL_MS = 15_000;
const tabCache = new Map<keyof typeof TABS, { promise: Promise<TabRow[]>; expiresAt: number }>();

function invalidateTab(tab: keyof typeof TABS): void {
  tabCache.delete(tab);
}

async function fetchTab(tab: keyof typeof TABS): Promise<TabRow[]> {
  await ensureSheetSetup();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${tab}!A2:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const headers = TABS[tab];
  const rows = res.data.values ?? [];
  return rows
    .map((row, i) => {
      const cells: Record<string, Cell> = {};
      headers.forEach((h, col) => {
        cells[h] = row[col] as Cell;
      });
      return { rowNumber: i + 2, cells };
    })
    .filter((r) => asString(r.cells[headers[0]]) !== "");
}

/**
 * Read all data rows of a tab as objects keyed by header, with 1-based sheet
 * row numbers. Cached (see TAB_CACHE_TTL_MS above) — concurrent callers
 * within the same request (or across requests, within the TTL) share one
 * in-flight fetch rather than each issuing their own.
 */
async function readTab(tab: keyof typeof TABS): Promise<TabRow[]> {
  const cached = tabCache.get(tab);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchTab(tab);
  tabCache.set(tab, { promise, expiresAt: Date.now() + TAB_CACHE_TTL_MS });
  try {
    return await promise;
  } catch (err) {
    // Don't let a failed fetch poison the cache for the rest of the TTL.
    if (tabCache.get(tab)?.promise === promise) tabCache.delete(tab);
    throw err;
  }
}

async function appendRows(tab: keyof typeof TABS, rows: Cell[][]): Promise<void> {
  if (rows.length === 0) return;
  await ensureSheetSetup();
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${tab}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows.map((r) => r.map((c) => c ?? "")) },
  });
  invalidateTab(tab);
}

export function newId(prefix: "usr" | "stmt" | "txn"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

let sheetIdCache: Map<string, number> | null = null;

/** Numeric sheetId per tab title (needed for row-deletion requests). */
async function getSheetIds(): Promise<Map<string, number>> {
  if (!sheetIdCache) {
    await ensureSheetSetup();
    const meta = await getSheets().spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: "sheets.properties(sheetId,title)",
    });
    sheetIdCache = new Map(
      (meta.data.sheets ?? []).map((s) => [
        s.properties?.title ?? "",
        s.properties?.sheetId ?? -1,
      ]),
    );
  }
  return sheetIdCache;
}

/** Delete specific 1-based rows from a tab (bottom-up, single batch request). */
async function deleteRows(
  requests: Array<{ tab: keyof typeof TABS; rowNumbers: number[] }>,
): Promise<void> {
  const sheetIds = await getSheetIds();
  const deletions = requests.flatMap(({ tab, rowNumbers }) => {
    const sheetId = sheetIds.get(tab);
    if (sheetId === undefined || sheetId === -1) return [];
    return rowNumbers.map((rowNumber) => ({ sheetId, rowNumber }));
  });
  if (deletions.length === 0) return;
  // Bottom-up so earlier deletions don't shift later indices.
  deletions.sort((a, b) => b.rowNumber - a.rowNumber);
  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: deletions.map((d) => ({
        deleteDimension: {
          range: {
            sheetId: d.sheetId,
            dimension: "ROWS",
            startIndex: d.rowNumber - 1,
            endIndex: d.rowNumber,
          },
        },
      })),
    },
  });
  requests.forEach((r) => invalidateTab(r.tab));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function toUser(cells: Record<string, Cell>): User {
  return {
    id: asString(cells.id),
    email: asString(cells.email),
    name: asString(cells.name),
    password_hash: asString(cells.password_hash),
    auth_provider: (asString(cells.auth_provider) || "credentials") as AuthProvider,
    created_at: asString(cells.created_at),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const target = email.toLowerCase().trim();
  const rows = await readTab("Users");
  const hit = rows.find((r) => asString(r.cells.email).toLowerCase() === target);
  return hit ? toUser(hit.cells) : null;
}

export async function createUser(user: {
  email: string;
  name: string;
  password_hash: string;
  auth_provider: AuthProvider;
}): Promise<User> {
  const record: User = {
    id: newId("usr"),
    email: user.email.toLowerCase().trim(),
    name: user.name,
    password_hash: user.password_hash,
    auth_provider: user.auth_provider,
    created_at: new Date().toISOString(),
  };
  await appendRows("Users", [
    [
      record.id,
      record.email,
      record.name,
      record.password_hash,
      record.auth_provider,
      record.created_at,
    ],
  ]);
  return record;
}

/** Update auth_provider (and optionally password_hash) in place — used for account linking. */
export async function updateUserAuth(
  email: string,
  changes: { auth_provider?: AuthProvider; password_hash?: string },
): Promise<void> {
  const target = email.toLowerCase().trim();
  const rows = await readTab("Users");
  const hit = rows.find((r) => asString(r.cells.email).toLowerCase() === target);
  if (!hit) return;
  const sheets = getSheets();
  const data: { range: string; values: Cell[][] }[] = [];
  if (changes.password_hash !== undefined) {
    data.push({ range: `Users!D${hit.rowNumber}`, values: [[changes.password_hash]] });
  }
  if (changes.auth_provider !== undefined) {
    data.push({ range: `Users!E${hit.rowNumber}`, values: [[changes.auth_provider]] });
  }
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  invalidateTab("Users");
}

// ---------------------------------------------------------------------------
// Categories (per user, lazily seeded)
// ---------------------------------------------------------------------------

/**
 * Pre-migration rows have no `type` cell. Only "Income & Refunds" is safely
 * inferrable as income — every other blank cell defaults to "expense", even
 * if the name happens to match one of the new default income categories
 * (e.g. a pre-existing custom "Business" expense category must NOT be
 * silently reclassified as income just because "Business" is now also a
 * default income category name for brand-new users).
 */
function inferDefaultType(name: string): CategoryType {
  return name === "Income & Refunds" ? "income" : "expense";
}

/** Same rationale as `inferDefaultType`: only the one category this app has ever hardcoded as excluded infers `true` on migration; everything else defaults to included. */
function inferDefaultExcluded(name: string): boolean {
  return name === "Payments & Transfers";
}

function toCategory(cells: Record<string, Cell>): Category {
  const budget = cells.monthly_budget;
  const storedType = asString(cells.type);
  const storedExcluded = asString(cells.excluded);
  return {
    user_id: asString(cells.user_id),
    name: asString(cells.name),
    type: (storedType || inferDefaultType(asString(cells.name))) as CategoryType,
    monthly_budget:
      budget === "" || budget === null || budget === undefined
        ? null
        : asNumber(budget),
    created_at: asString(cells.created_at),
    excluded: storedExcluded
      ? storedExcluded.toUpperCase() === "TRUE"
      : inferDefaultExcluded(asString(cells.name)),
  };
}

export async function getCategories(userId: string): Promise<Category[]> {
  const rows = await readTab("Categories");
  const mineRows = rows.filter((r) => asString(r.cells.user_id) === userId);
  if (mineRows.length > 0) {
    // Self-heal rows written before the `type`/`excluded` columns existed.
    const backfills: { range: string; values: string[][] }[] = [];
    for (const r of mineRows) {
      const name = asString(r.cells.name);
      if (!asString(r.cells.type)) {
        backfills.push({
          range: `Categories!E${r.rowNumber}`,
          values: [[inferDefaultType(name)]],
        });
      }
      if (!asString(r.cells.excluded)) {
        backfills.push({
          range: `Categories!F${r.rowNumber}`,
          values: [[inferDefaultExcluded(name) ? "TRUE" : "FALSE"]],
        });
      }
    }
    if (backfills.length > 0) {
      await getSheets().spreadsheets.values.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: { valueInputOption: "RAW", data: backfills },
      });
      invalidateTab("Categories");
    }

    // Add any default category this account doesn't already have BY NAME
    // (case-insensitive) — e.g. an existing account picking up the new
    // income categories introduced after it first signed up. Never touches
    // or duplicates a category that already exists, even one whose name
    // collides with a default (that existing category wins).
    const existingNames = new Set(
      mineRows.map((r) => asString(r.cells.name).toLowerCase()),
    );
    const missing = DEFAULT_CATEGORIES.filter(
      (c) => !existingNames.has(c.name.toLowerCase()),
    );
    const now = new Date().toISOString();
    if (missing.length > 0) {
      await appendRows(
        "Categories",
        missing.map((c) => [
          userId,
          c.name,
          "",
          now,
          c.type,
          c.excluded ? "TRUE" : "FALSE",
        ]),
      );
    }

    return [
      ...mineRows.map((r) => toCategory(r.cells)),
      ...missing.map((c) => ({
        user_id: userId,
        name: c.name,
        type: c.type,
        monthly_budget: null,
        created_at: now,
        excluded: c.excluded,
      })),
    ];
  }

  // First use: seed defaults for this user.
  const now = new Date().toISOString();
  await appendRows(
    "Categories",
    DEFAULT_CATEGORIES.map((c) => [
      userId,
      c.name,
      "",
      now,
      c.type,
      c.excluded ? "TRUE" : "FALSE",
    ]),
  );
  return DEFAULT_CATEGORIES.map((c) => ({
    user_id: userId,
    name: c.name,
    type: c.type,
    monthly_budget: null,
    created_at: now,
    excluded: c.excluded,
  }));
}

export async function addCategory(
  userId: string,
  name: string,
  type: CategoryType,
): Promise<void> {
  // New categories are never excluded by default — the user just asked to track this one.
  await appendRows("Categories", [
    [userId, name, "", new Date().toISOString(), type, "FALSE"],
  ]);
}

/** Set (or clear) a category's per-cycle budget. */
export async function updateCategoryBudget(
  userId: string,
  name: string,
  budget: number | null,
): Promise<boolean> {
  const rows = await readTab("Categories");
  const hit = rows.find(
    (r) =>
      asString(r.cells.user_id) === userId &&
      asString(r.cells.name).toLowerCase() === name.toLowerCase(),
  );
  if (!hit) return false;
  await getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `Categories!C${hit.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [[budget === null ? "" : budget]] },
  });
  invalidateTab("Categories");
  return true;
}

/** Toggle whether a category is hidden from every dashboard entirely (card payments, ATM withdrawals, internal transfers, etc.). */
export async function updateCategoryExcluded(
  userId: string,
  name: string,
  excluded: boolean,
): Promise<boolean> {
  const rows = await readTab("Categories");
  const hit = rows.find(
    (r) =>
      asString(r.cells.user_id) === userId &&
      asString(r.cells.name).toLowerCase() === name.toLowerCase(),
  );
  if (!hit) return false;
  await getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `Categories!F${hit.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [[excluded ? "TRUE" : "FALSE"]] },
  });
  invalidateTab("Categories");
  return true;
}

// ---------------------------------------------------------------------------
// Category rules (per user, append-only, last row wins)
// ---------------------------------------------------------------------------

export async function getRules(userId: string): Promise<Map<string, string>> {
  const rows = await readTab("CategoryRules");
  const map = new Map<string, string>();
  for (const r of rows) {
    if (asString(r.cells.user_id) !== userId) continue;
    map.set(asString(r.cells.merchant_normalized), asString(r.cells.category));
  }
  return map;
}

export async function appendRules(
  userId: string,
  rules: Array<{ merchant_normalized: string; category: string }>,
): Promise<void> {
  const now = new Date().toISOString();
  await appendRows(
    "CategoryRules",
    rules.map((r) => [userId, r.merchant_normalized, r.category, now]),
  );
}

// ---------------------------------------------------------------------------
// Recurring dismissals (per user) — Trends Dashboard "dismiss" / "restore"
// ---------------------------------------------------------------------------

export async function getDismissedRecurring(userId: string): Promise<Set<string>> {
  const rows = await readTab("RecurringDismissals");
  const set = new Set<string>();
  for (const r of rows) {
    if (asString(r.cells.user_id) !== userId) continue;
    set.add(asString(r.cells.merchant_normalized));
  }
  return set;
}

export async function dismissRecurring(
  userId: string,
  merchantNormalized: string,
): Promise<void> {
  const existing = await getDismissedRecurring(userId);
  if (existing.has(merchantNormalized)) return; // avoid duplicate rows on repeat calls
  await appendRows("RecurringDismissals", [
    [userId, merchantNormalized, new Date().toISOString()],
  ]);
}

export async function undismissRecurring(
  userId: string,
  merchantNormalized: string,
): Promise<void> {
  const rows = await readTab("RecurringDismissals");
  const rowNumbers = rows
    .filter(
      (r) =>
        asString(r.cells.user_id) === userId &&
        asString(r.cells.merchant_normalized) === merchantNormalized,
    )
    .map((r) => r.rowNumber);
  if (rowNumbers.length === 0) return;
  await deleteRows([{ tab: "RecurringDismissals", rowNumbers }]);
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

function toStatement(cells: Record<string, Cell>): Statement {
  return {
    id: asString(cells.id),
    user_id: asString(cells.user_id),
    uploaded_at: asString(cells.uploaded_at),
    period_start: asString(cells.period_start),
    period_end: asString(cells.period_end),
    source_filename: asString(cells.source_filename),
    currency: asString(cells.currency),
    total_debits: asNumber(cells.total_debits),
    total_credits: asNumber(cells.total_credits),
    transaction_count: asNumber(cells.transaction_count),
    content_hash: asString(cells.content_hash),
    title: asString(cells.title),
  };
}

export async function getStatements(userId: string): Promise<Statement[]> {
  const rows = await readTab("Statements");
  return rows
    .filter((r) => asString(r.cells.user_id) === userId)
    .map((r) => toStatement(r.cells));
}

export async function getStatementById(
  userId: string,
  statementId: string,
): Promise<Statement | null> {
  const all = await getStatements(userId);
  return all.find((s) => s.id === statementId) ?? null;
}

export async function findStatementByHash(
  userId: string,
  contentHash: string,
): Promise<Statement | null> {
  const all = await getStatements(userId);
  return all.find((s) => s.content_hash === contentHash) ?? null;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

function toTxn(cells: Record<string, Cell>): Txn {
  return {
    id: asString(cells.id),
    user_id: asString(cells.user_id),
    statement_id: asString(cells.statement_id),
    date: asString(cells.date),
    description: asString(cells.description),
    merchant: asString(cells.merchant),
    merchant_normalized: asString(cells.merchant_normalized),
    amount: asNumber(cells.amount),
    direction: (asString(cells.direction) || "debit") as Direction,
    currency: asString(cells.currency),
    category: asString(cells.category),
    categorized_by: (asString(cells.categorized_by) || "ai") as CategorizedBy,
  };
}

/** All transactions for a user, restricted to statements that actually committed. */
export async function getTransactions(userId: string): Promise<Txn[]> {
  const [rows, statements] = await Promise.all([
    readTab("Transactions"),
    getStatements(userId),
  ]);
  const committed = new Set(statements.map((s) => s.id));
  return rows
    .map((r) => toTxn(r.cells))
    .filter((t) => t.user_id === userId && committed.has(t.statement_id));
}

export async function getTransactionsByStatement(
  userId: string,
  statementId: string,
): Promise<Txn[]> {
  const all = await getTransactions(userId);
  return all.filter((t) => t.statement_id === statementId);
}

/**
 * Change one transaction's category (user re-categorization from the
 * statement view). Returns the row's merchant_normalized so the caller can
 * update the learned rules.
 */
export async function updateTransactionCategory(
  userId: string,
  txnId: string,
  category: string,
): Promise<{ merchant_normalized: string; previous_category: string } | null> {
  const rows = await readTab("Transactions");
  const hit = rows.find(
    (r) => asString(r.cells.id) === txnId && asString(r.cells.user_id) === userId,
  );
  if (!hit) return null;
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      valueInputOption: "RAW",
      // Transactions columns: … K=category, L=categorized_by
      data: [
        { range: `Transactions!K${hit.rowNumber}:L${hit.rowNumber}`, values: [[category, "user"]] },
      ],
    },
  });
  invalidateTab("Transactions");
  return {
    merchant_normalized: asString(hit.cells.merchant_normalized),
    previous_category: asString(hit.cells.category),
  };
}

// ---------------------------------------------------------------------------
// Delete (user-requested removal of statement data)
// ---------------------------------------------------------------------------

/**
 * Delete one or more transactions in a single batch (one row-delete request
 * plus one totals-sync request, regardless of how many ids are passed), and
 * keep every affected statement's cached total_debits/total_credits/
 * transaction_count in sync — the Statements list displays those directly
 * rather than summing transactions live. Ids not found or not owned by this
 * user are silently skipped. Selected transactions may span more than one
 * statement; each is adjusted independently.
 */
export async function deleteTransactions(
  userId: string,
  txnIds: string[],
): Promise<{ deleted: number }> {
  if (txnIds.length === 0) return { deleted: 0 };
  const idSet = new Set(txnIds);
  const [txnRows, stmtRows] = await Promise.all([
    readTab("Transactions"),
    readTab("Statements"),
  ]);
  const hits = txnRows.filter(
    (r) => idSet.has(asString(r.cells.id)) && asString(r.cells.user_id) === userId,
  );
  if (hits.length === 0) return { deleted: 0 };

  // Aggregate each affected statement's debit/credit/count adjustment before
  // deleting rows, since row numbers below shift once rows are removed.
  const adjustments = new Map<string, { debits: number; credits: number; count: number }>();
  for (const hit of hits) {
    const statementId = asString(hit.cells.statement_id);
    const direction = asString(hit.cells.direction) || "debit";
    const amount = asNumber(hit.cells.amount);
    const adj = adjustments.get(statementId) ?? { debits: 0, credits: 0, count: 0 };
    if (direction === "debit") adj.debits += amount;
    else adj.credits += amount;
    adj.count += 1;
    adjustments.set(statementId, adj);
  }

  await deleteRows([{ tab: "Transactions", rowNumbers: hits.map((h) => h.rowNumber) }]);

  const updates: { range: string; values: number[][] }[] = [];
  for (const [statementId, adj] of adjustments) {
    const stmt = stmtRows.find(
      (r) => asString(r.cells.id) === statementId && asString(r.cells.user_id) === userId,
    );
    if (!stmt) continue;
    const nextDebits = Math.max(
      0,
      Math.round((asNumber(stmt.cells.total_debits) - adj.debits) * 100) / 100,
    );
    const nextCredits = Math.max(
      0,
      Math.round((asNumber(stmt.cells.total_credits) - adj.credits) * 100) / 100,
    );
    const nextCount = Math.max(0, asNumber(stmt.cells.transaction_count) - adj.count);
    updates.push({
      // Statements columns: … H=total_debits, I=total_credits, J=transaction_count
      range: `Statements!H${stmt.rowNumber}:J${stmt.rowNumber}`,
      values: [[nextDebits, nextCredits, nextCount]],
    });
  }
  if (updates.length > 0) {
    await getSheets().spreadsheets.values.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: { valueInputOption: "RAW", data: updates },
    });
    invalidateTab("Statements");
  }

  return { deleted: hits.length };
}

/** Delete one statement and every transaction in it. Learned rules stay. */
export async function deleteStatementData(
  userId: string,
  statementId: string,
): Promise<{ deleted_transactions: number } | null> {
  const [txnRows, stmtRows] = await Promise.all([
    readTab("Transactions"),
    readTab("Statements"),
  ]);
  const stmt = stmtRows.find(
    (r) =>
      asString(r.cells.id) === statementId &&
      asString(r.cells.user_id) === userId,
  );
  if (!stmt) return null;
  const txnNumbers = txnRows
    .filter(
      (r) =>
        asString(r.cells.statement_id) === statementId &&
        asString(r.cells.user_id) === userId,
    )
    .map((r) => r.rowNumber);
  await deleteRows([
    { tab: "Transactions", rowNumbers: txnNumbers },
    { tab: "Statements", rowNumbers: [stmt.rowNumber] },
  ]);
  return { deleted_transactions: txnNumbers.length };
}

/** Delete ALL of a user's statements and transactions. Rules and categories stay. */
export async function deleteAllStatementData(
  userId: string,
): Promise<{ deleted_statements: number; deleted_transactions: number }> {
  const [txnRows, stmtRows] = await Promise.all([
    readTab("Transactions"),
    readTab("Statements"),
  ]);
  const txnNumbers = txnRows
    .filter((r) => asString(r.cells.user_id) === userId)
    .map((r) => r.rowNumber);
  const stmtNumbers = stmtRows
    .filter((r) => asString(r.cells.user_id) === userId)
    .map((r) => r.rowNumber);
  await deleteRows([
    { tab: "Transactions", rowNumbers: txnNumbers },
    { tab: "Statements", rowNumbers: stmtNumbers },
  ]);
  return {
    deleted_statements: stmtNumbers.length,
    deleted_transactions: txnNumbers.length,
  };
}

// ---------------------------------------------------------------------------
// Save (ordered: transactions → rules → statement commit row)
// ---------------------------------------------------------------------------

export async function saveStatement(input: {
  userId: string;
  statement: {
    period_start: string;
    period_end: string;
    source_filename: string;
    currency: string;
    content_hash: string;
    title: string;
  };
  transactions: Array<{
    date: string;
    description: string;
    merchant: string;
    merchant_normalized: string;
    amount: number;
    direction: Direction;
    currency: string;
    category: string;
    categorized_by: CategorizedBy;
  }>;
  newRules: Array<{ merchant_normalized: string; category: string }>;
}): Promise<{ statement_id: string }> {
  const { userId, statement, transactions, newRules } = input;
  const statementId = newId("stmt");

  await appendRows(
    "Transactions",
    transactions.map((t) => [
      newId("txn"),
      userId,
      statementId,
      t.date,
      t.description,
      t.merchant,
      t.merchant_normalized,
      t.amount,
      t.direction,
      t.currency,
      t.category,
      t.categorized_by,
    ]),
  );

  if (newRules.length > 0) {
    await appendRules(userId, newRules);
  }

  const totalDebits = transactions
    .filter((t) => t.direction === "debit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = transactions
    .filter((t) => t.direction === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  // Commit marker: written last so partial saves are invisible to readers.
  await appendRows("Statements", [
    [
      statementId,
      userId,
      new Date().toISOString(),
      statement.period_start,
      statement.period_end,
      statement.source_filename,
      statement.currency,
      Math.round(totalDebits * 100) / 100,
      Math.round(totalCredits * 100) / 100,
      transactions.length,
      statement.content_hash,
      statement.title,
    ],
  ]);

  return { statement_id: statementId };
}
