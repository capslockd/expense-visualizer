export type Direction = "debit" | "credit";
export type CategorizedBy = "ai" | "rule" | "user" | "keyword";
export type AuthProvider = "google" | "credentials" | "both";

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
  monthly_budget: number | null;
  created_at: string;
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
  categories: string[];
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

export const DEFAULT_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Health",
  "Travel",
  "Subscriptions",
  "Housing",
  "Insurance",
  "Education",
  "Fees & Charges",
  "Income & Refunds",
  "Payments & Transfers",
];

/** Categories excluded from expense analytics. */
export const NON_EXPENSE_CATEGORIES = ["Payments & Transfers"];
export const MONEY_IN_CATEGORY = "Income & Refunds";
