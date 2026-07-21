export type Direction = "debit" | "credit";
export type CategorizedBy = "ai" | "rule" | "user" | "keyword";
export type AuthProvider = "google" | "credentials" | "both";
/** Whether a category counts toward income or expense analytics. */
export type CategoryType = "expense" | "income";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  auth_provider: AuthProvider;
  created_at: string;
}

export interface Statement {
  id: string;
  user_id: string;
  uploaded_at: string;
  period_start: string;
  period_end: string;
  source_filename: string;
  currency: string;
  total_debits: number;
  total_credits: number;
  transaction_count: number;
  content_hash: string;
  /** Optional user-given friendly name, e.g. "July NAB card". */
  title: string;
}

export interface Txn {
  id: string;
  user_id: string;
  statement_id: string;
  date: string;
  description: string;
  merchant: string;
  merchant_normalized: string;
  amount: number;
  direction: Direction;
  currency: string;
  category: string;
  categorized_by: CategorizedBy;
}

export interface CategoryRule {
  user_id: string;
  merchant_normalized: string;
  category: string;
  created_at: string;
}

export interface Category {
  user_id: string;
  name: string;
  type: CategoryType;
  monthly_budget: number | null;
  created_at: string;
  /** Hidden from every dashboard entirely — for card payments, ATM withdrawals, internal transfers, etc. that aren't real income or expense. */
  excluded: boolean;
}

/** A transaction as returned by /api/extract, before the user has reviewed it. */
export interface ExtractedTxn {
  tempId: string;
  date: string;
  description: string;
  merchant: string;
  merchant_normalized: string;
  amount: number;
  direction: Direction;
  currency: string;
  category: string | null;
  needs_review: boolean;
  categorized_by: "ai" | "rule" | "keyword";
  confidence_note: string | null;
}

export interface ExtractedStatement {
  period_start: string | null;
  period_end: string | null;
  currency: string;
  source_filename: string;
  account_hint: string | null;
  content_hash: string;
  duplicate_of: string | null;
}

export interface ExtractResponse {
  statement: ExtractedStatement;
  transactions: ExtractedTxn[];
  warnings: string[];
  categories: { name: string; type: CategoryType }[];
}

export interface SaveStatementRequest {
  statement: {
    period_start: string | null;
    period_end: string | null;
    currency: string;
    source_filename: string;
    content_hash: string;
  };
  transactions: Array<{
    tempId: string;
    date: string;
    description: string;
    merchant: string;
    merchant_normalized: string;
    amount: number;
    direction: Direction;
    currency: string;
    category: string;
    categorized_by: CategorizedBy;
    remember?: boolean;
    /** What the AI originally proposed (null = needed review) — used to derive new rules server-side. */
    ai_proposal: string | null;
  }>;
  allowDuplicate?: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/** Categories that may never exist — the app's hard requirement. */
export const FORBIDDEN_CATEGORY_NAMES = [
  "miscellaneous",
  "misc",
  "other",
  "others",
  "uncategorized",
  "uncategorised",
  "unknown",
  "general",
];

export interface DefaultCategory {
  name: string;
  type: CategoryType;
  excluded: boolean;
}

/**
 * Seeded per-user on first use. Order is the seed/dropdown order — expense
 * categories first, then income. "Payments & Transfers" is excluded by
 * default (card payments and internal transfers aren't real spending or
 * income) — its `type` is a don't-care default, never consulted once a
 * category is excluded. Exclusion is a toggle: the user can flip any
 * category (including this one) via Manage categories.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Groceries", type: "expense", excluded: false },
  { name: "Dining", type: "expense", excluded: false },
  { name: "Transport", type: "expense", excluded: false },
  { name: "Utilities", type: "expense", excluded: false },
  { name: "Entertainment", type: "expense", excluded: false },
  { name: "Shopping", type: "expense", excluded: false },
  { name: "Health", type: "expense", excluded: false },
  { name: "Travel", type: "expense", excluded: false },
  { name: "Subscriptions", type: "expense", excluded: false },
  { name: "Housing", type: "expense", excluded: false },
  { name: "Insurance", type: "expense", excluded: false },
  { name: "Education", type: "expense", excluded: false },
  { name: "Fees & Charges", type: "expense", excluded: false },
  { name: "Payments & Transfers", type: "expense", excluded: true },
  { name: "Salary", type: "income", excluded: false },
  { name: "Business", type: "income", excluded: false },
  { name: "eBay", type: "income", excluded: false },
  { name: "Website", type: "income", excluded: false },
  { name: "Government Benefits", type: "income", excluded: false },
  { name: "Interest & Cashback", type: "income", excluded: false },
  { name: "Tax Refunds", type: "income", excluded: false },
  { name: "Income & Refunds", type: "income", excluded: false },
];
