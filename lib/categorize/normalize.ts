/**
 * Canonicalize a merchant name into a stable rule key.
 * The SAME function is used when applying rules and when writing new ones,
 * so keys always match.
 */
export function normalizeMerchant(raw: string): string {
  let s = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['’]/g, "") // apostrophes vanish: MCDONALD'S → MCDONALDS
    .replace(/[^A-Z0-9& ]+/g, " ") // other punctuation → space (keep &)
    .replace(/\s+/g, " ")
    .trim();

  // Drop trailing store numbers / reference tokens: "MCDONALDS 40123" → "MCDONALDS"
  const tokens = s.split(" ");
  while (
    tokens.length > 1 &&
    /^\d{2,}$/.test(tokens[tokens.length - 1])
  ) {
    tokens.pop();
  }
  s = tokens.join(" ");

  return s;
}
