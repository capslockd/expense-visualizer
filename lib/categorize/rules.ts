import { ExtractedTxn } from "@/lib/types";

/**
 * Apply the user's confirmed merchant → category rules on top of AI proposals.
 * Rules are authoritative: they override the AI and clear needs_review, so
 * re-asking provably decreases over time regardless of model behavior.
 */
export function applyRules(
  txns: ExtractedTxn[],
  rules: Map<string, string>,
  validCategories: Set<string>,
): void {
  for (const txn of txns) {
    const ruleCategory = rules.get(txn.merchant_normalized);
    if (ruleCategory && validCategories.has(ruleCategory)) {
      txn.category = ruleCategory;
      txn.needs_review = false;
      txn.categorized_by = "rule";
      txn.confidence_note = null;
    }
  }
}
