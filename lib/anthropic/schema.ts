import { z } from "zod";

/**
 * Built at request time so the category enum reflects the signed-in user's
 * live Categories tab. Constraints stay within structured-outputs support
 * (no min/max, no regex, no recursion).
 */
export function buildExtractionSchema(categoryNames: string[]) {
  const CategoryEnum = z.enum(categoryNames as [string, ...string[]]);

  const TransactionSchema = z.object({
    date: z
      .string()
      .describe(
        "Transaction date as ISO 8601 (YYYY-MM-DD). If the line omits the year, infer it from the statement period.",
      ),
    description: z
      .string()
      .describe(
        "The raw line-item text as printed, including any foreign-currency notation.",
      ),
    merchant: z
      .string()
      .describe(
        "Human-readable merchant name, cleaned of store numbers, city/country codes, and payment-processor prefixes such as 'SQ *', 'PAYPAL *', 'POS'.",
      ),
    amount: z
      .number()
      .describe(
        "Absolute value of the billed amount in the transaction currency. Always positive.",
      ),
    direction: z
      .enum(["debit", "credit"])
      .describe(
        "debit = money out (a charge). credit = money in (refund, cashback, or a payment made to the account).",
      ),
    currency: z
      .string()
      .describe(
        "ISO 4217 code of the billed amount, e.g. SGD, USD, PHP. Usually the statement currency.",
      ),
    proposed_category: CategoryEnum.nullable().describe(
      "One of the allowed categories, ONLY if genuinely confident. null when not confident — null is a correct answer, not a failure.",
    ),
    needs_review: z
      .boolean()
      .describe(
        "true when proposed_category is null OR the assignment is a low-confidence guess between plausible categories.",
      ),
    confidence_note: z
      .string()
      .nullable()
      .describe(
        "One short phrase explaining the uncertainty when needs_review is true, else null.",
      ),
  });

  return z.object({
    document_status: z
      .enum(["ok", "not_a_statement", "unreadable"])
      .describe(
        "ok = a readable financial statement. not_a_statement = the document is something else. unreadable = a statement but too degraded/truncated to extract.",
      ),
    period_start: z
      .string()
      .nullable()
      .describe("Statement period start date, YYYY-MM-DD. null if not stated."),
    period_end: z
      .string()
      .nullable()
      .describe("Statement period end date, YYYY-MM-DD. null if not stated."),
    statement_currency: z
      .string()
      .describe("Primary billing currency of the statement (ISO 4217)."),
    account_hint: z
      .string()
      .nullable()
      .describe(
        "Card or account identifier hint if visible, e.g. last 4 digits. null otherwise.",
      ),
    transactions: z.array(TransactionSchema),
    warnings: z
      .array(z.string())
      .describe(
        "Anything odd: truncated pages, ambiguous dates, totals that do not reconcile with the line items.",
      ),
  });
}

export type ExtractionResult = z.infer<ReturnType<typeof buildExtractionSchema>>;
