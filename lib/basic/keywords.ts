import { Direction } from "@/lib/types";

/**
 * Merchant keyword → category dictionary for the non-AI engine.
 * Tuned for AUSTRALIAN merchants and bank descriptors, plus unambiguous
 * global brands. Matched with word-boundary semantics against the
 * NORMALIZED merchant/description string (uppercase, punctuation stripped).
 *
 * ORDER MATTERS — first match wins, so specific entries must precede
 * general ones (e.g. "COLES EXPRESS" fuel before "COLES" groceries,
 * "BOOST JUICE" before any future "BOOST"). Generic phrases (payments,
 * income, fees) sit at the END so real merchant names win first
 * (e.g. "BPAY ORIGIN ENERGY" → Utilities, not Payments & Transfers).
 *
 * A miss means "ask the user", never a guess — and the user's own learned
 * CategoryRules always override this dictionary.
 *
 * An entry may carry an optional 3rd element restricting it to one
 * direction — for merchants that mean something different as a debit
 * (a purchase) vs a credit (e.g. a marketplace payout, which could also be
 * a refund of that same purchase — genuinely ambiguous, so it's left
 * unmatched on credit rather than guessed).
 */
const KEYWORDS: Array<[string, string] | [string, string, Direction]> = [
  // --- Specific-before-general disambiguations ------------------------
  // SALARY/PAYROLL are checked before every merchant keyword below because
  // a payslip's reference text often names the employer or payroll
  // processor — which can itself be a recognized merchant (e.g. a "Salary
  // Deposit ... Energy Australia ..." credit must stay Salary, not get
  // intercepted by the "ENERGY AUSTRALIA" → Utilities merchant match).
  ["SALARY", "Salary"], ["PAYROLL", "Salary"],
  ["COLES EXPRESS", "Transport"], // Shell Coles Express fuel
  ["REDDY EXPRESS", "Transport"], // Coles Express rebrand
  ["WOOLWORTHS PETROL", "Transport"],
  ["WOOLWORTHS CALTEX", "Transport"],
  ["BOOST JUICE", "Dining"],
  ["BOOST MOBILE", "Utilities"],
  ["VIRGIN AUSTRALIA", "Travel"],
  ["VIRGIN ACTIVE", "Health"],
  ["AMAZON WEB SERVICES", "Subscriptions"], // before AMAZON → Shopping

  // --- Groceries -------------------------------------------------------
  ["WOOLWORTHS", "Groceries"], ["COLES", "Groceries"], ["ALDI", "Groceries"],
  ["IGA", "Groceries"], ["FOODWORKS", "Groceries"], ["FOODLAND", "Groceries"],
  ["HARRIS FARM", "Groceries"], ["DRAKES", "Groceries"], ["SPUDSHED", "Groceries"],
  ["COSTCO", "Groceries"], ["7 ELEVEN", "Groceries"], ["7ELEVEN", "Groceries"],
  ["NIGHTOWL", "Groceries"], ["EZYMART", "Groceries"],
  ["DAN MURPHYS", "Groceries"], ["BWS", "Groceries"], ["LIQUORLAND", "Groceries"],
  ["FIRST CHOICE LIQUOR", "Groceries"], ["VINTAGE CELLARS", "Groceries"],
  ["BAKERS DELIGHT", "Groceries"], ["THE REJECT SHOP", "Groceries"],

  // --- Dining ----------------------------------------------------------
  ["MCDONALDS", "Dining"], ["MACCAS", "Dining"], ["KFC", "Dining"],
  ["HUNGRY JACKS", "Dining"], ["RED ROOSTER", "Dining"], ["OPORTO", "Dining"],
  ["NANDOS", "Dining"], ["GUZMAN Y GOMEZ", "Dining"], ["GYG", "Dining"],
  ["ZAMBRERO", "Dining"], ["MAD MEX", "Dining"], ["GRILLD", "Dining"],
  ["BETTYS BURGERS", "Dining"], ["SCHNITZ", "Dining"], ["SUBWAY", "Dining"],
  ["DOMINOS", "Dining"], ["PIZZA HUT", "Dining"], ["CRUST PIZZA", "Dining"],
  ["SUSHI HUB", "Dining"], ["SUSHI TRAIN", "Dining"], ["ROLL D", "Dining"],
  ["STARBUCKS", "Dining"], ["GLORIA JEANS", "Dining"], ["THE COFFEE CLUB", "Dining"],
  ["MICHELS PATISSERIE", "Dining"], ["DONUT KING", "Dining"],
  ["MENULOG", "Dining"], ["UBER EATS", "Dining"], ["UBEREATS", "Dining"],
  ["DOORDASH", "Dining"], ["DELIVEROO", "Dining"], ["HEY YOU", "Dining"],
  ["JOLLIBEE", "Dining"], ["BURGER KING", "Dining"], ["DUNKIN", "Dining"],

  // --- Transport ---------------------------------------------------------
  ["UBER", "Transport"], ["DIDI", "Transport"], ["13CABS", "Transport"],
  ["SILVER TOP", "Transport"], ["GOCATCH", "Transport"],
  ["OPAL", "Transport"], ["TRANSPORTFORNSW", "Transport"], ["TRANSPORT FOR NSW", "Transport"],
  ["MYKI", "Transport"], ["PTV", "Transport"], ["PUBLIC TRANSPORT", "Transport"],
  ["YARRA TRAMS", "Transport"],
  ["METRO TRAINS", "Transport"], ["VLINE", "Transport"], ["V LINE", "Transport"],
  ["TRANSLINK", "Transport"], ["GO CARD", "Transport"], ["ADELAIDE METRO", "Transport"],
  ["TRANSPERTH", "Transport"], ["METRO TASMANIA", "Transport"],
  ["AMPOL", "Transport"], ["CALTEX", "Transport"], ["BP", "Transport"],
  ["SHELL", "Transport"], ["MOBIL", "Transport"], ["UNITED PETROLEUM", "Transport"],
  ["PUMA ENERGY", "Transport"], ["METRO PETROLEUM", "Transport"],
  ["LINKT", "Transport"], ["CITYLINK", "Transport"], ["EASTLINK", "Transport"],
  ["E TOLL", "Transport"], ["ETOLL", "Transport"], ["TRANSURBAN", "Transport"],
  ["WILSON PARKING", "Transport"], ["SECURE PARKING", "Transport"],
  ["CARE PARK", "Transport"], ["PARKING", "Transport"], ["EASYPARK", "Transport"],
  ["TESLA", "Transport"], ["EVIE NETWORKS", "Transport"], ["CHARGEFOX", "Transport"],
  ["VICROADS", "Transport"], ["SERVICE NSW", "Transport"],

  // --- Utilities & telecom ----------------------------------------------
  ["TELSTRA", "Utilities"], ["OPTUS", "Utilities"], ["VODAFONE", "Utilities"],
  ["TPG", "Utilities"], ["IINET", "Utilities"], ["AUSSIE BROADBAND", "Utilities"],
  ["BELONG", "Utilities"], ["AMAYSIM", "Utilities"], ["SUPERLOOP", "Utilities"],
  ["FELIX MOBILE", "Utilities"], ["TANGERINE", "Utilities"],
  ["AGL", "Utilities"], ["ORIGIN ENERGY", "Utilities"], ["ENERGYAUSTRALIA", "Utilities"],
  ["ENERGY AUSTRALIA", "Utilities"], ["ALINTA", "Utilities"], ["RED ENERGY", "Utilities"],
  ["SIMPLY ENERGY", "Utilities"], ["POWERSHOP", "Utilities"], ["MOMENTUM ENERGY", "Utilities"],
  ["ERGON", "Utilities"], ["SYNERGY", "Utilities"], ["AURORA ENERGY", "Utilities"],
  ["SYDNEY WATER", "Utilities"], ["YARRA VALLEY WATER", "Utilities"],
  ["SA WATER", "Utilities"], ["URBAN UTILITIES", "Utilities"], ["WATER CORPORATION", "Utilities"],

  // --- Subscriptions ------------------------------------------------------
  ["NETFLIX", "Subscriptions"], ["STAN", "Subscriptions"], ["BINGE", "Subscriptions"],
  ["KAYO", "Subscriptions"], ["FOXTEL", "Subscriptions"], ["PARAMOUNT", "Subscriptions"],
  ["DISNEY", "Subscriptions"], ["SPOTIFY", "Subscriptions"], ["YOUTUBE PREMIUM", "Subscriptions"],
  ["APPLE COM BILL", "Subscriptions"], ["ICLOUD", "Subscriptions"],
  ["GOOGLE ONE", "Subscriptions"], ["GOOGLE STORAGE", "Subscriptions"],
  ["AMAZON PRIME", "Subscriptions"], ["PRIME VIDEO", "Subscriptions"],
  ["AUDIBLE", "Subscriptions"], ["MICROSOFT 365", "Subscriptions"],
  ["ADOBE", "Subscriptions"], ["DROPBOX", "Subscriptions"], ["CANVA", "Subscriptions"],
  ["CHATGPT", "Subscriptions"], ["OPENAI", "Subscriptions"], ["ANTHROPIC", "Subscriptions"],
  ["PATREON", "Subscriptions"],

  // --- Shopping -----------------------------------------------------------
  ["KMART", "Shopping"], ["BIG W", "Shopping"], ["TARGET", "Shopping"],
  ["MYER", "Shopping"], ["DAVID JONES", "Shopping"], ["JB HI FI", "Shopping"],
  ["JB HIFI", "Shopping"], ["HARVEY NORMAN", "Shopping"], ["THE GOOD GUYS", "Shopping"],
  ["OFFICEWORKS", "Shopping"], ["BUNNINGS", "Shopping"], ["IKEA", "Shopping"],
  ["AMAZON", "Shopping"], ["AMZN", "Shopping"],
  // Debit-only: a credit "EBAY" line could be a purchase refund (keeps the
  // original category) or a seller payout ("eBay" income) — ambiguous, so
  // it's left unmatched on credit and falls to needs_review.
  ["EBAY", "Shopping", "debit"],
  ["CATCH", "Shopping"], ["KOGAN", "Shopping"], ["TEMPLE & WEBSTER", "Shopping"],
  ["COTTON ON", "Shopping"], ["COUNTRY ROAD", "Shopping"], ["UNIQLO", "Shopping"],
  ["ZARA", "Shopping"], ["H&M", "Shopping"], ["THE ICONIC", "Shopping"],
  ["REBEL", "Shopping"], ["BCF", "Shopping"], ["ANACONDA", "Shopping"],
  ["SUPERCHEAP AUTO", "Shopping"], ["REPCO", "Shopping"], ["DECATHLON", "Shopping"],
  ["SPOTLIGHT", "Shopping"], ["FANTASTIC FURNITURE", "Shopping"],
  ["FREEDOM FURNITURE", "Shopping"], ["ETSY", "Shopping"], ["TEMU", "Shopping"],
  ["SHEIN", "Shopping"], ["ALIEXPRESS", "Shopping"], ["TAOBAO", "Shopping"],

  // --- Health --------------------------------------------------------------
  ["CHEMIST WAREHOUSE", "Health"], ["CWH", "Health"], ["PRICELINE", "Health"], ["TERRYWHITE", "Health"],
  ["AMCAL", "Health"], ["PHARMACY", "Health"], ["CHEMIST", "Health"],
  ["CLINIC", "Health"], ["DENTAL", "Health"], ["HOSPITAL", "Health"],
  ["MEDICAL CENTRE", "Health"], ["PHYSIO", "Health"], ["OPTOMETRIST", "Health"],
  ["SPECSAVERS", "Health"], ["OPSM", "Health"],
  ["ANYTIME FITNESS", "Health"], ["F45", "Health"], ["GOODLIFE", "Health"],
  ["FITNESS FIRST", "Health"], ["JETTS", "Health"], ["PLUS FITNESS", "Health"],
  ["SNAP FITNESS", "Health"], ["CLASSPASS", "Health"], ["GYM", "Health"],

  // --- Insurance -------------------------------------------------------------
  ["NRMA", "Insurance"], ["AAMI", "Insurance"], ["ALLIANZ", "Insurance"],
  ["BUDGET DIRECT", "Insurance"], ["YOUI", "Insurance"], ["GIO", "Insurance"],
  ["RACV", "Insurance"], ["RACQ", "Insurance"], ["RAA", "Insurance"],
  ["RAC WA", "Insurance"], ["QBE", "Insurance"], ["SUNCORP INSURANCE", "Insurance"],
  ["MEDIBANK", "Insurance"], ["BUPA", "Insurance"], ["HCF", "Insurance"],
  ["NIB", "Insurance"], ["AHM", "Insurance"], ["HBF", "Insurance"],
  ["INSURANCE", "Insurance"],

  // --- Travel -------------------------------------------------------------
  ["QANTAS", "Travel"], ["JETSTAR", "Travel"], ["REX AIRLINES", "Travel"],
  ["AIR NEW ZEALAND", "Travel"], ["EMIRATES", "Travel"], ["SINGAPORE AIRLINES", "Travel"],
  ["CATHAY PACIFIC", "Travel"], ["QATAR AIRWAYS", "Travel"], ["AIRASIA", "Travel"],
  ["WEBJET", "Travel"], ["FLIGHT CENTRE", "Travel"], ["LUXURY ESCAPES", "Travel"],
  ["WOTIF", "Travel"], ["BOOKING COM", "Travel"], ["AIRBNB", "Travel"],
  ["AGODA", "Travel"], ["EXPEDIA", "Travel"], ["TRIP COM", "Travel"],
  ["KLOOK", "Travel"], ["HOTEL", "Travel"], ["MOTEL", "Travel"],
  ["MARRIOTT", "Travel"], ["HILTON", "Travel"], ["ACCOR", "Travel"],
  ["EUROPCAR", "Travel"], ["HERTZ", "Travel"], ["AVIS", "Travel"], ["THRIFTY", "Travel"],

  // --- Entertainment ---------------------------------------------------------
  ["EVENT CINEMAS", "Entertainment"], ["HOYTS", "Entertainment"],
  ["VILLAGE CINEMAS", "Entertainment"], ["PALACE CINEMAS", "Entertainment"],
  ["READING CINEMAS", "Entertainment"], ["CINEMA", "Entertainment"],
  ["TICKETEK", "Entertainment"], ["TICKETMASTER", "Entertainment"],
  ["STEAM GAMES", "Entertainment"], ["STEAMGAMES", "Entertainment"],
  ["PLAYSTATION", "Entertainment"], ["NINTENDO", "Entertainment"],
  ["XBOX", "Entertainment"], ["TIMEZONE", "Entertainment"],

  // --- Education ----------------------------------------------------------
  ["UDEMY", "Education"], ["COURSERA", "Education"], ["SKILLSHARE", "Education"],
  ["DUOLINGO", "Education"], ["DYMOCKS", "Education"], ["QBD BOOKS", "Education"],
  ["TAFE", "Education"], ["TUITION", "Education"],

  // --- Housing ---------------------------------------------------------------
  ["RAY WHITE", "Housing"], ["LJ HOOKER", "Housing"], ["MCGRATH", "Housing"],
  ["REAL ESTATE", "Housing"], ["STRATA", "Housing"], ["COUNCIL RATES", "Housing"],
  ["BODY CORPORATE", "Housing"],

  // --- Generic phrases LAST (so merchant names above win first) ---------------
  // Income (SALARY/PAYROLL live in the disambiguations section above)
  ["CENTRELINK", "Government Benefits"],
  ["CASHBACK", "Interest & Cashback"], ["CASH REBATE", "Interest & Cashback"],
  ["INTEREST EARNED", "Interest & Cashback"], ["INTEREST CREDIT", "Interest & Cashback"],
  ["TAX REFUND", "Tax Refunds"],
  // Fees
  ["ANNUAL FEE", "Fees & Charges"], ["ACCOUNT KEEPING FEE", "Fees & Charges"],
  ["MONTHLY ACCOUNT FEE", "Fees & Charges"], ["LATE PAYMENT", "Fees & Charges"],
  ["LATE CHARGE", "Fees & Charges"], ["INTEREST CHARGE", "Fees & Charges"],
  ["FINANCE CHARGE", "Fees & Charges"], ["OVERDRAWN FEE", "Fees & Charges"],
  ["DISHONOUR FEE", "Fees & Charges"], ["ATM FEE", "Fees & Charges"],
  ["INTL TRANSACTION FEE", "Fees & Charges"],
  ["INTERNATIONAL TRANSACTION FEE", "Fees & Charges"],
  ["FOREIGN TRANSACTION FEE", "Fees & Charges"],
  ["TRAN FEE", "Fees & Charges"], // e.g. "NAB INTNL TRAN FEE"
  ["TRANSACTION FEE", "Fees & Charges"],
  // Payments & transfers (no bare "BPAY"/"DIRECT DEBIT" — those usually pay bills)
  ["PAYMENT RECEIVED", "Payments & Transfers"],
  ["PAYMENT THANK YOU", "Payments & Transfers"],
  ["THANK YOU FOR YOUR PAYMENT", "Payments & Transfers"],
  ["DIRECT DEBIT RECEIVED", "Payments & Transfers"],
  ["CREDIT CARD PAYMENT", "Payments & Transfers"],
  ["BALANCE TRANSFER", "Payments & Transfers"],
  ["TRANSFER TO", "Payments & Transfers"],
  ["TRANSFER FROM", "Payments & Transfers"],
  ["FUNDS TRANSFER", "Payments & Transfers"],
  ["OSKO", "Payments & Transfers"],
  ["PAYID", "Payments & Transfers"],
];

/**
 * Word-boundary match: every keyword must appear as whole word(s) inside the
 * normalized text, so "BP" matches "BP CONNECT" but not "BPAY", and "TARGET"
 * matches "TARGET AUSTRALIA" but never a token like "TARGETED".
 * First match in KEYWORDS order wins. Only returns categories that exist in
 * the user's category list. Entries restricted to a direction are skipped
 * when the transaction's direction doesn't match.
 */
export function matchKeyword(
  normalizedText: string,
  validCategories: Set<string>,
  direction: Direction,
): string | null {
  const padded = ` ${normalizedText} `;
  for (const [keyword, category, restrictTo] of KEYWORDS) {
    if (restrictTo && restrictTo !== direction) continue;
    if (padded.includes(` ${keyword} `) && validCategories.has(category)) {
      return category;
    }
  }
  return null;
}
