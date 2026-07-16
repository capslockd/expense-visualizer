/**
 * Built-in merchant keyword → category dictionary for the non-AI engine.
 * Matched as substrings against the NORMALIZED merchant string (uppercase).
 * Deliberately conservative: a miss means "ask the user", never a guess —
 * and the user's own CategoryRules always override these.
 */
const KEYWORDS: Array<[string, string]> = [
  // Payments & transfers (checked against full description too)
  ["PAYMENT RECEIVED", "Payments & Transfers"],
  ["PAYMENT THANK YOU", "Payments & Transfers"],
  ["THANK YOU FOR YOUR PAYMENT", "Payments & Transfers"],
  ["GIRO PAYMENT", "Payments & Transfers"],
  ["AUTOPAY", "Payments & Transfers"],
  ["BALANCE TRANSFER", "Payments & Transfers"],
  ["FUNDS TRANSFER", "Payments & Transfers"],
  ["FAST TRANSFER", "Payments & Transfers"],
  ["PAYNOW", "Payments & Transfers"],
  ["INSTAPAY", "Payments & Transfers"],
  ["PESONET", "Payments & Transfers"],

  // Income
  ["SALARY", "Income & Refunds"],
  ["PAYROLL", "Income & Refunds"],
  ["CASHBACK", "Income & Refunds"],
  ["CASH REBATE", "Income & Refunds"],
  ["INTEREST EARNED", "Income & Refunds"],
  ["INTEREST CREDIT", "Income & Refunds"],

  // Fees
  ["ANNUAL FEE", "Fees & Charges"],
  ["LATE CHARGE", "Fees & Charges"],
  ["LATE PAYMENT", "Fees & Charges"],
  ["INTEREST CHARGE", "Fees & Charges"],
  ["FINANCE CHARGE", "Fees & Charges"],
  ["SERVICE CHARGE", "Fees & Charges"],
  ["ATM FEE", "Fees & Charges"],
  ["FOREIGN TRANSACTION FEE", "Fees & Charges"],

  // Groceries
  ["NTUC", "Groceries"], ["FAIRPRICE", "Groceries"], ["COLD STORAGE", "Groceries"],
  ["GIANT", "Groceries"], ["SHENG SIONG", "Groceries"], ["REDMART", "Groceries"],
  ["WALMART", "Groceries"], ["COSTCO", "Groceries"], ["ALDI", "Groceries"],
  ["TESCO", "Groceries"], ["WOOLWORTHS", "Groceries"], ["COLES", "Groceries"],
  ["7 ELEVEN", "Groceries"], ["7ELEVEN", "Groceries"], ["CHEERS", "Groceries"],
  ["SM SUPERMARKET", "Groceries"], ["PUREGOLD", "Groceries"], ["ROBINSONS SUPERMARKET", "Groceries"],
  ["MERCURY DRUG", "Health"], ["DON DON DONKI", "Groceries"],

  // Dining
  ["MCDONALD", "Dining"], ["STARBUCKS", "Dining"], ["KFC", "Dining"],
  ["BURGER KING", "Dining"], ["SUBWAY", "Dining"], ["JOLLIBEE", "Dining"],
  ["PIZZA HUT", "Dining"], ["DOMINO", "Dining"], ["CHATIME", "Dining"],
  ["KOI THE", "Dining"], ["GONG CHA", "Dining"], ["TOAST BOX", "Dining"],
  ["YA KUN", "Dining"], ["KOPITIAM", "Dining"], ["FOODPANDA", "Dining"],
  ["GRABFOOD", "Dining"], ["DELIVEROO", "Dining"], ["DOORDASH", "Dining"],
  ["UBER EATS", "Dining"], ["UBEREATS", "Dining"], ["COFFEE BEAN", "Dining"],
  ["DUNKIN", "Dining"], ["WENDYS", "Dining"], ["CHOWKING", "Dining"],
  ["MANG INASAL", "Dining"], ["GREENWICH", "Dining"], ["SHAKEYS", "Dining"],

  // Transport
  ["GRAB", "Transport"], ["UBER", "Transport"], ["GOJEK", "Transport"],
  ["LYFT", "Transport"], ["COMFORTDELGRO", "Transport"], ["CDG TAXI", "Transport"],
  ["EZ LINK", "Transport"], ["EZLINK", "Transport"], ["TRANSITLINK", "Transport"],
  ["SMRT", "Transport"], ["SBS TRANSIT", "Transport"], ["SHELL", "Transport"],
  ["CALTEX", "Transport"], ["ESSO", "Transport"], ["PETRON", "Transport"],
  ["PETRONAS", "Transport"], ["SPC", "Transport"], ["PARKING", "Transport"],
  ["ERP", "Transport"], ["ANGKAS", "Transport"], ["BEEP", "Transport"],

  // Utilities & telecom
  ["SINGTEL", "Utilities"], ["STARHUB", "Utilities"], ["M1 LIMITED", "Utilities"],
  ["CIRCLES LIFE", "Utilities"], ["SP SERVICES", "Utilities"], ["SP GROUP", "Utilities"],
  ["SENOKO", "Utilities"], ["GENECO", "Utilities"], ["PLDT", "Utilities"],
  ["GLOBE TELECOM", "Utilities"], ["SMART COMMUNICATIONS", "Utilities"],
  ["MERALCO", "Utilities"], ["MAYNILAD", "Utilities"], ["MANILA WATER", "Utilities"],
  ["AT&T", "Utilities"], ["VERIZON", "Utilities"], ["T MOBILE", "Utilities"],

  // Subscriptions
  ["NETFLIX", "Subscriptions"], ["SPOTIFY", "Subscriptions"], ["YOUTUBE PREMIUM", "Subscriptions"],
  ["DISNEY", "Subscriptions"], ["HBO", "Subscriptions"], ["APPLE COM BILL", "Subscriptions"],
  ["ICLOUD", "Subscriptions"], ["GOOGLE ONE", "Subscriptions"], ["GOOGLE STORAGE", "Subscriptions"],
  ["AMAZON PRIME", "Subscriptions"], ["PATREON", "Subscriptions"], ["MICROSOFT 365", "Subscriptions"],
  ["ADOBE", "Subscriptions"], ["DROPBOX", "Subscriptions"], ["CHATGPT", "Subscriptions"],
  ["OPENAI", "Subscriptions"], ["ANTHROPIC", "Subscriptions"], ["CANVA", "Subscriptions"],

  // Shopping
  ["AMAZON", "Shopping"], ["AMZN", "Shopping"], ["SHOPEE", "Shopping"],
  ["LAZADA", "Shopping"], ["TAOBAO", "Shopping"], ["ALIEXPRESS", "Shopping"],
  ["SHEIN", "Shopping"], ["UNIQLO", "Shopping"], ["IKEA", "Shopping"],
  ["ZARA", "Shopping"], ["H&M", "Shopping"], ["DECATHLON", "Shopping"],
  ["CHALLENGER", "Shopping"], ["COURTS", "Shopping"], ["HARVEY NORMAN", "Shopping"],
  ["BEST DENKI", "Shopping"], ["EBAY", "Shopping"], ["ETSY", "Shopping"],
  ["QOO10", "Shopping"], ["CAROUSELL", "Shopping"],

  // Health
  ["GUARDIAN", "Health"], ["WATSONS", "Health"], ["UNITY PHARMACY", "Health"],
  ["PHARMACY", "Health"], ["CLINIC", "Health"], ["DENTAL", "Health"],
  ["HOSPITAL", "Health"], ["POLYCLINIC", "Health"], ["RAFFLES MEDICAL", "Health"],
  ["FITNESS FIRST", "Health"], ["ANYTIME FITNESS", "Health"], ["CLASSPASS", "Health"],
  ["GYM", "Health"],

  // Travel
  ["AIRBNB", "Travel"], ["AGODA", "Travel"], ["BOOKING COM", "Travel"],
  ["EXPEDIA", "Travel"], ["TRIP COM", "Travel"], ["TRAVELOKA", "Travel"],
  ["SINGAPORE AIR", "Travel"], ["SINGAPORE AIRLINES", "Travel"], ["SCOOT", "Travel"],
  ["AIRASIA", "Travel"], ["CEBU PACIFIC", "Travel"], ["PHILIPPINE AIRLINES", "Travel"],
  ["JETSTAR", "Travel"], ["EMIRATES", "Travel"], ["QATAR AIRWAYS", "Travel"],
  ["CATHAY PACIFIC", "Travel"], ["KLOOK", "Travel"], ["MARRIOTT", "Travel"],
  ["HILTON", "Travel"], ["HOTEL", "Travel"], ["HOSTEL", "Travel"],

  // Entertainment
  ["GOLDEN VILLAGE", "Entertainment"], ["CATHAY CINEPLEX", "Entertainment"],
  ["SHAW THEATRES", "Entertainment"], ["CINEMA", "Entertainment"],
  ["STEAM GAMES", "Entertainment"], ["STEAMGAMES", "Entertainment"],
  ["PLAYSTATION", "Entertainment"], ["NINTENDO", "Entertainment"],
  ["XBOX", "Entertainment"], ["TICKETMASTER", "Entertainment"],
  ["SISTIC", "Entertainment"],

  // Education
  ["UDEMY", "Education"], ["COURSERA", "Education"], ["SKILLSHARE", "Education"],
  ["DUOLINGO", "Education"], ["KINOKUNIYA", "Education"], ["POPULAR BOOK", "Education"],
  ["NATIONAL LIBRARY", "Education"], ["TUITION", "Education"],

  // Insurance
  ["AIA ", "Insurance"], ["PRUDENTIAL", "Insurance"], ["GREAT EASTERN", "Insurance"],
  ["NTUC INCOME", "Insurance"], ["INCOME INSURANCE", "Insurance"], ["AXA", "Insurance"],
  ["ALLIANZ", "Insurance"], ["MANULIFE", "Insurance"], ["SUNLIFE", "Insurance"],
  ["INSURANCE", "Insurance"],
];

/**
 * Match a normalized merchant/description against the dictionary.
 * Only returns categories that exist in the user's category list.
 */
export function matchKeyword(
  normalizedText: string,
  validCategories: Set<string>,
): string | null {
  for (const [keyword, category] of KEYWORDS) {
    if (normalizedText.includes(keyword) && validCategories.has(category)) {
      return category;
    }
  }
  return null;
}
