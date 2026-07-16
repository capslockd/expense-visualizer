import { Category } from "@/lib/types";

/**
 * Short model-facing descriptions for the seeded categories.
 * Examples skew Australian — this app's user base is primarily in Australia,
 * so expect Australian merchants, banks (DD/MM dates), and AUD statements.
 */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Groceries: "supermarkets, convenience stores, bottle shops (Woolworths, Coles, ALDI, IGA, 7-Eleven grocery runs, Dan Murphy's, BWS)",
  Dining: "restaurants, cafes, coffee, pubs (food/drink), food delivery (McDonald's, Hungry Jack's, Guzman y Gomez, Boost Juice, Menulog, Uber Eats, DoorDash)",
  Transport: "ride-hailing, public transport, fuel, parking, tolls, taxis (Uber, DiDi, Opal, Myki, Translink, Ampol, BP, Coles Express fuel, Linkt/CityLink tolls)",
  Utilities: "electricity, gas, water, internet, mobile phone bills (AGL, Origin Energy, EnergyAustralia, Telstra, Optus, Vodafone, TPG, Aussie Broadband)",
  Entertainment: "movies, games, concerts, hobbies (Event Cinemas, Hoyts, Ticketek, Steam; one-off cinema tickets here — recurring streaming is Subscriptions)",
  Shopping: "retail goods, clothing, electronics, hardware, online marketplaces (Kmart, Big W, Target, JB Hi-Fi, Bunnings, Officeworks, Amazon, The Iconic, eBay)",
  Health: "pharmacies, clinics, dental, hospitals, optometrists, fitness, gyms (Chemist Warehouse, Priceline, Specsavers, Anytime Fitness, Medicare gap payments)",
  Travel: "flights, hotels, travel bookings, car hire, trip spending clearly tied to travel (Qantas, Jetstar, Virgin Australia, Webjet, Airbnb, Booking.com)",
  Subscriptions: "recurring digital services and memberships (Netflix, Stan, Binge, Kayo, Spotify, iCloud, Foxtel, SaaS, news)",
  Housing: "rent (often via real estate agents like Ray White, LJ Hooker), mortgage payments, strata/body corporate, council rates, home maintenance",
  Insurance: "insurance premiums of any kind (NRMA, AAMI, Budget Direct, Medibank, Bupa, HCF, NIB, car/home/health/life)",
  Education: "tuition, courses, books, school and TAFE fees, learning platforms",
  "Fees & Charges": "bank fees, card annual fees, account-keeping fees, interest charges, late fees, international transaction fees levied by the bank itself",
  "Income & Refunds": "incoming money that is NOT a refund of an identifiable purchase: salary, Centrelink payments, cashback credited, interest earned. (A refund of an identifiable purchase keeps the original purchase's category, with direction credit.)",
  "Payments & Transfers": "payments made TO this account/card (e.g. 'PAYMENT RECEIVED - THANK YOU'), BPAY/Osko/PayID transfers between own accounts, balance transfers. Not an expense. (BPAY paying a biller like Origin Energy belongs to that biller's category instead.)",
};

export function buildSystemPrompt(
  categories: Category[],
  rules: Map<string, string>,
): string {
  const categoryLines = categories
    .map((c) => {
      const desc = CATEGORY_DESCRIPTIONS[c.name];
      return desc ? `- ${c.name}: ${desc}` : `- ${c.name}`;
    })
    .join("\n");

  const ruleLines =
    rules.size > 0
      ? [...rules.entries()].map(([m, c]) => `- ${m} → ${c}`).join("\n")
      : null;

  return `You are a precise financial-statement parser. Extract every individual transaction line from the provided credit card or bank statement.

# Extraction rules
- Extract EVERY transaction line. Never invent, merge, split, or drop transactions.
- Exclude non-transaction lines: running balances, previous/carried-forward balances, subtotals, interest and rewards summaries, credit-limit notices, minimum-payment notices.
- date: ISO 8601 (YYYY-MM-DD). If a line shows only day and month, infer the year from the statement period (watch for periods spanning a year boundary).
- amount: always positive. Encode money-out as direction "debit" and money-in as direction "credit".
- merchant: clean, human-readable name. Strip payment-processor prefixes ("SQ *", "PAYPAL *", "TST*", "POS"), trailing store numbers, and city/country codes — but keep the actual business name intact.
- Foreign-currency lines: amount and currency are the BILLED amount in the statement currency; keep the original foreign amount inside description.

# Allowed categories (the complete list — there are no others)
${categoryLines}

Notes on the two special categories:
- "Payments & Transfers" is for payments made to this account/card and transfers between accounts — these are not expenses.
- A credit that refunds an identifiable purchase gets the ORIGINAL purchase's category (with direction "credit"), not "Income & Refunds".
${
    ruleLines
      ? `
# User-confirmed merchant rules (authoritative)
The user has previously confirmed these merchant → category mappings. When a transaction's merchant matches one, use that category with needs_review = false:
${ruleLines}
`
      : ""
  }
# The no-guessing contract (critical)
There is NO "Miscellaneous", "Other", or "Uncategorized" option, and you must never approximate one by picking a weakly-fitting category. Assign proposed_category ONLY when you are genuinely confident. If a reasonable person would need to ask the user what the purchase actually was, set proposed_category to null and needs_review to true — a null category is a correct answer, not a failure. Also set needs_review to true when an assignment is a coin-flip between two categories, and say why in confidence_note.

# Statement metadata
Extract the statement period (period_start/period_end), the primary billing currency, and an account hint (e.g. card last-4) when visible. If the document is not a financial statement, set document_status to "not_a_statement" and return an empty transactions array; if it is a statement but unreadable, use "unreadable".`;
}
