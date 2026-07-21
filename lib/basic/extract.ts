import { ExtractionError } from "@/lib/anthropic/extract";
import { ExtractionResult } from "@/lib/anthropic/schema";
import { normalizeMerchant } from "@/lib/categorize/normalize";
import { Category } from "@/lib/types";
import { basicParse } from "./parse";
import { matchKeyword } from "./keywords";

/**
 * Common Australian bank category names → this app's categories.
 * Used as a FALLBACK when our curated keyword dictionary has no opinion —
 * bank exports (ANZ, CommBank, Westpac, NAB, Up, ING…) often ship their own
 * category column, and mapping its vocabulary saves a lot of manual review.
 * Names with no clean equivalent (e.g. "Pets") are deliberately absent —
 * those go to review so the user can pick (or create) the right category.
 */
const BANK_CATEGORY_SYNONYMS: Record<string, string> = {
  groceries: "Groceries",
  supermarkets: "Groceries",
  "dining": "Dining",
  "eating out": "Dining",
  restaurants: "Dining",
  cafes: "Dining",
  "cafes & coffee": "Dining",
  takeaway: "Dining",
  "takeaway food": "Dining",
  "food delivery": "Dining",
  "food & drink": "Dining",
  "pubs & bars": "Dining",
  transport: "Transport",
  "public transport": "Transport",
  "vehicle expenses": "Transport",
  fuel: "Transport",
  petrol: "Transport",
  parking: "Transport",
  "parking & tolls": "Transport",
  tolls: "Transport",
  rideshare: "Transport",
  "taxis & rideshare": "Transport",
  "car expenses": "Transport",
  utilities: "Utilities",
  internet: "Utilities",
  "phone & internet": "Utilities",
  "mobile phone": "Utilities",
  electricity: "Utilities",
  "gas & electricity": "Utilities",
  water: "Utilities",
  entertainment: "Entertainment",
  "movies & music": "Entertainment",
  games: "Entertainment",
  hobbies: "Entertainment",
  shopping: "Shopping",
  "other shopping": "Shopping",
  "clothing & accessories": "Shopping",
  "clothes & shoes": "Shopping",
  homeware: "Shopping",
  "home improvements": "Shopping",
  electronics: "Shopping",
  "electronics & appliances": "Shopping",
  "department stores": "Shopping",
  "online shopping": "Shopping",
  health: "Health",
  "health & medical": "Health",
  medical: "Health",
  pharmacy: "Health",
  fitness: "Health",
  "gym & fitness": "Health",
  "personal care": "Health",
  travel: "Travel",
  holidays: "Travel",
  accommodation: "Travel",
  flights: "Travel",
  subscriptions: "Subscriptions",
  memberships: "Subscriptions",
  streaming: "Subscriptions",
  rent: "Housing",
  mortgage: "Housing",
  "mortgage & rent": "Housing",
  housing: "Housing",
  insurance: "Insurance",
  education: "Education",
  "education & training": "Education",
  "fees & charges": "Fees & Charges",
  "bank fees": "Fees & Charges",
  fees: "Fees & Charges",
  interest: "Fees & Charges",
  salary: "Salary",
  wages: "Salary",
  income: "Income & Refunds",
  transfers: "Payments & Transfers",
  transfer: "Payments & Transfers",
  payments: "Payments & Transfers",
  "credit card payment": "Payments & Transfers",
  "credit card payments": "Payments & Transfers",
  "internal transfer": "Payments & Transfers",
};

/** Light display cleanup — strip processor prefixes and trailing reference codes. */
function cleanDisplayMerchant(description: string): string {
  let s = description
    .replace(/^(SQ|TST|PP|PAYPAL|POS|IZ|EZY|SP)\s*\*\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop trailing long reference tokens: "GRAB* RIDE 7XKQP SG" → keep words, drop pure refs
  s = s.replace(/\s+[A-Z0-9]{10,}$/i, "").trim();
  return s || description.trim();
}

/**
 * Non-AI extraction: deterministic CSV/Excel parsing + keyword-dictionary
 * categorization. Anything without a confident keyword match is flagged
 * needs_review — the review gate does the rest. Returns the same shape as
 * the AI path so the route's downstream handling is identical.
 */
export function basicExtract(
  text: string,
  categories: Category[],
): ExtractionResult {
  const parsed = basicParse(text);
  if (!parsed || parsed.transactions.length === 0) {
    throw new ExtractionError(
      "BASIC_PARSE_FAILED",
      "Couldn't find transactions in this file. The basic (no-AI) parser needs a CSV/Excel export with date, description, and amount columns — or add Anthropic credits to parse any format with AI.",
    );
  }

  const validCategories = new Set(categories.map((c) => c.name));
  // Case-insensitive lookup so a bank-provided "GROCERIES" maps to "Groceries".
  const categoryByLower = new Map(
    categories.map((c) => [c.name.toLowerCase(), c.name]),
  );
  const warnings = [...parsed.warnings];
  let currency = parsed.currency;
  if (!currency) {
    currency = "AUD";
    warnings.push(
      "Couldn't detect the statement currency — defaulted to AUD. Fix it with the currency selector above the table if that's wrong.",
    );
  }

  return {
    document_status: "ok",
    period_start: parsed.period_start,
    period_end: parsed.period_end,
    statement_currency: currency,
    account_hint: parsed.account_hint,
    warnings,
    transactions: parsed.transactions.map((t) => {
      // Prefer the bank's own merchant column when the export has one.
      const merchant = t.merchant || cleanDisplayMerchant(t.description);
      // Category precedence: our curated keyword dictionary first (it encodes
      // this app's semantics, e.g. Coles Express = fuel), then the bank's
      // category column — exact name match or a known synonym.
      const bankRaw = t.bank_category?.toLowerCase().trim() ?? null;
      const bankCategory = bankRaw
        ? (categoryByLower.get(bankRaw) ??
          (BANK_CATEGORY_SYNONYMS[bankRaw] &&
          validCategories.has(BANK_CATEGORY_SYNONYMS[bankRaw])
            ? BANK_CATEGORY_SYNONYMS[bankRaw]
            : null))
        : null;
      const proposed =
        matchKeyword(
          normalizeMerchant(`${t.description} ${t.merchant ?? ""}`),
          validCategories,
          t.direction,
        ) ?? bankCategory;
      return {
        date: t.date,
        description: t.description,
        merchant,
        amount: t.amount,
        direction: t.direction,
        currency: currency as string,
        proposed_category: proposed,
        needs_review: proposed === null,
        confidence_note: proposed === null ? "no keyword match" : null,
      };
    }),
  };
}
