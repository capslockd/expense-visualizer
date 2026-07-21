/**
 * Deterministic CSV statement parser for the non-AI engine.
 * Handles: quoted CSV, header detection, single signed-amount columns,
 * debit/credit column pairs, DR/CR markers, parenthesised negatives,
 * D/M/Y vs M/D/Y disambiguation, and multi-sheet Excel exports
 * (pre-converted to "### Sheet:" sections by intake).
 */

export interface ParsedRow {
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number; // always positive
  direction: "debit" | "credit";
  /** Bank-provided merchant name column, when the export has one. */
  merchant: string | null;
  /** Bank-provided category column, when the export has one. */
  bank_category: string | null;
}

export interface BasicParseResult {
  transactions: ParsedRow[];
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  account_hint: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------- CSV core

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y > 70 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse one date cell. `dayFirst` resolves numeric x/y/z ambiguity. */
function parseDate(raw: string, dayFirst: boolean): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    if (a > 12) return toIso(y, b, a);
    if (b > 12) return toIso(y, a, b);
    return dayFirst ? toIso(y, b, a) : toIso(y, a, b);
  }

  // Textual month, any of space/hyphen/dot/slash separators: "16 Jul 2026",
  // "16-Jul-26" (common in AU bank exports), "16.Jul.26"
  m = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})\.?,?[\s\-/.]+(\d{2,4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toUpperCase()]) {
    return toIso(+m[3], MONTHS[m[2].slice(0, 3).toUpperCase()], +m[1]);
  }

  m = s.match(/^([A-Za-z]{3,9})\.?,?[\s\-/.]+(\d{1,2})[\s\-/.]+(\d{2,4})$/);
  if (m && MONTHS[m[1].slice(0, 3).toUpperCase()]) {
    return toIso(+m[3], MONTHS[m[1].slice(0, 3).toUpperCase()], +m[2]);
  }

  return null;
}

/** Scan all values: if any first-part > 12 → day-first; any second-part > 12 → month-first. */
function detectDayFirst(values: string[]): { dayFirst: boolean; certain: boolean } {
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.]\d{2,4}$/);
    if (!m) continue;
    if (+m[1] > 12) return { dayFirst: true, certain: true };
    if (+m[2] > 12) return { dayFirst: false, certain: true };
  }
  return { dayFirst: true, certain: false }; // default D/M/Y (most banks outside the US)
}

// ---------------------------------------------------------------- amounts

const CURRENCY_HINTS: Array<[RegExp, string]> = [
  [/A\$|AUD/, "AUD"], [/NZ\$|NZD/, "NZD"], [/S\$|SGD/, "SGD"], [/HK\$|HKD/, "HKD"],
  [/US\$|USD/, "USD"], [/₱|PHP/, "PHP"], [/RM|MYR/, "MYR"], [/£|GBP/, "GBP"],
  [/€|EUR/, "EUR"], [/¥|JPY/, "JPY"], [/IDR|Rp/, "IDR"], [/₹|INR/, "INR"],
  // Bare "$" is AUD for this app's (Australian) user base.
  [/\$/, "AUD"],
];

interface ParsedAmount {
  value: number; // signed
  marker: "debit" | "credit" | null; // explicit DR/CR marker
  currencyHint: string | null;
}

function parseAmount(raw: string): ParsedAmount | null {
  let s = raw.trim();
  if (!s) return null;

  let marker: "debit" | "credit" | null = null;
  const mMark = s.match(/\b(CR|DR)\.?$/i);
  if (mMark) {
    marker = mMark[1].toUpperCase() === "CR" ? "credit" : "debit";
    s = s.slice(0, mMark.index).trim();
  }

  let currencyHint: string | null = null;
  for (const [re, code] of CURRENCY_HINTS) {
    if (re.test(s)) {
      currencyHint = code;
      break;
    }
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  s = s.replace(/[^0-9.]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return { value: negative ? -value : value, marker, currencyHint };
}

// ---------------------------------------------------------------- header & column detection

interface Columns {
  headerRowIdx: number; // -1 = no header
  dateIdx: number;
  descIdx: number;
  amountIdx: number; // -1 when debit/credit pair used
  debitIdx: number;
  creditIdx: number;
  currencyIdx: number;
  merchantIdx: number; // bank-provided merchant name column
  bankCategoryIdx: number; // bank-provided category column
}

function detectColumns(rows: string[][]): Columns | null {
  const isBalance = (h: string) => /balance/i.test(h);

  // Look for a header row in the first 15 rows.
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((c) => c.trim());
    const dateIdx = row.findIndex((h) => /date/i.test(h) && !/update/i.test(h));
    if (dateIdx === -1) continue;
    const hasAmountish = row.some(
      (h) => /amount|value|debit|credit|withdrawal|deposit/i.test(h) && !isBalance(h),
    );
    if (!hasAmountish) continue;

    // Prefer "transaction date" over "posting/value date" when both exist.
    const txnDateIdx = row.findIndex((h) => /trans.*date/i.test(h));
    const finalDateIdx = txnDateIdx !== -1 ? txnDateIdx : dateIdx;

    const debitIdx = row.findIndex((h) => /debit|withdrawal/i.test(h) && !isBalance(h));
    const creditIdx = row.findIndex((h) => /credit|deposit/i.test(h) && !isBalance(h) && !/credit card/i.test(h));
    const amountIdx = row.findIndex((h) => /amount|value/i.test(h) && !isBalance(h) && !/date/i.test(h));
    // Real text of the line item. "Transaction Details" yes; "Transaction Type"
    // (PURCHASE AUTHORISATION / CREDIT CARD PURCHASE labels) no.
    let descIdx = row.findIndex((h) =>
      /desc(?!ending)|detail|narrat|particular|payee/i.test(h),
    );
    if (descIdx === -1) {
      descIdx = row.findIndex((h) => /reference|transaction(?!\s*(date|type))/i.test(h));
    }
    const merchantIdx = row.findIndex((h) => /merchant/i.test(h));
    const bankCategoryIdx = row.findIndex((h) => /^category$/i.test(h.trim()));
    const currencyIdx = row.findIndex((h) => /^curr|ccy/i.test(h));

    const pair = debitIdx !== -1 && creditIdx !== -1 && debitIdx !== creditIdx;
    if (!pair && amountIdx === -1) continue;

    return {
      headerRowIdx: i,
      dateIdx: finalDateIdx,
      descIdx,
      amountIdx: pair ? -1 : amountIdx,
      debitIdx: pair ? debitIdx : -1,
      creditIdx: pair ? creditIdx : -1,
      currencyIdx,
      merchantIdx,
      bankCategoryIdx,
    };
  }

  // No header: infer by content from the first data row that has ≥3 cells.
  const sample = rows.find((r) => r.length >= 3);
  if (!sample) return null;
  const n = Math.max(...rows.map((r) => r.length));
  let dateIdx = -1;
  let amountIdx = -1;
  for (let c = 0; c < n; c++) {
    const vals = rows.slice(0, 20).map((r) => r[c] ?? "");
    const dates = vals.filter((v) => parseDate(v, true)).length;
    const amounts = vals.filter((v) => parseAmount(v)).length;
    if (dateIdx === -1 && dates >= Math.max(2, vals.length * 0.5)) dateIdx = c;
    else if (amountIdx === -1 && amounts >= Math.max(2, vals.length * 0.5)) amountIdx = c;
  }
  if (dateIdx === -1 || amountIdx === -1) return null;
  return {
    headerRowIdx: -1,
    dateIdx,
    descIdx: -1,
    amountIdx,
    debitIdx: -1,
    creditIdx: -1,
    currencyIdx: -1,
    merchantIdx: -1,
    bankCategoryIdx: -1,
  };
}

// ---------------------------------------------------------------- main

function parseSection(text: string): BasicParseResult | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const cols = detectColumns(rows);
  if (!cols) return null;

  const warnings: string[] = [];
  const dataRows = rows.slice(cols.headerRowIdx + 1);

  const { dayFirst, certain } = detectDayFirst(
    dataRows.map((r) => r[cols.dateIdx] ?? ""),
  );
  if (!certain) {
    const anyNumeric = dataRows.some((r) =>
      /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test((r[cols.dateIdx] ?? "").trim()),
    );
    if (anyNumeric) {
      warnings.push(
        "Dates were ambiguous (e.g. 03/06) — assumed day/month/year. Check the dates in the review table.",
      );
    }
  }

  // Description column fallback: the longest non-date, non-amount text column.
  let descIdx = cols.descIdx;
  if (descIdx === -1) {
    const n = Math.max(...dataRows.map((r) => r.length));
    let best = -1;
    let bestLen = 0;
    for (let c = 0; c < n; c++) {
      if (c === cols.dateIdx || c === cols.amountIdx || c === cols.debitIdx || c === cols.creditIdx) continue;
      const totalLen = dataRows.reduce((s, r) => s + (r[c]?.trim().length ?? 0), 0);
      const looksNumeric = dataRows.every((r) => !r[c]?.trim() || parseAmount(r[c]) !== null);
      if (!looksNumeric && totalLen > bestLen) {
        best = c;
        bestLen = totalLen;
      }
    }
    descIdx = best;
  }

  interface RawTxn {
    date: string;
    description: string;
    signed: number;
    marker: "debit" | "credit" | null;
    merchant: string | null;
    bank_category: string | null;
  }
  const raw: RawTxn[] = [];
  let currency: string | null = null;

  for (const r of dataRows) {
    const date = parseDate(r[cols.dateIdx] ?? "", dayFirst);
    if (!date) continue;
    const description = (descIdx !== -1 ? (r[descIdx] ?? "") : r.filter((c) => c.trim()).join(" ")).trim();
    if (/^(opening|closing|previous|brought forward|carried forward|sub ?total|total)\b/i.test(description)) continue;
    const merchant =
      cols.merchantIdx !== -1 ? (r[cols.merchantIdx] ?? "").trim() || null : null;
    const bank_category =
      cols.bankCategoryIdx !== -1
        ? (r[cols.bankCategoryIdx] ?? "").trim() || null
        : null;

    if (cols.debitIdx !== -1) {
      const dr = parseAmount(r[cols.debitIdx] ?? "");
      const cr = parseAmount(r[cols.creditIdx] ?? "");
      currency ??= dr?.currencyHint ?? cr?.currencyHint ?? null;
      if (dr && Math.abs(dr.value) > 0) {
        raw.push({ date, description, signed: -Math.abs(dr.value), marker: "debit", merchant, bank_category });
      } else if (cr && Math.abs(cr.value) > 0) {
        raw.push({ date, description, signed: Math.abs(cr.value), marker: "credit", merchant, bank_category });
      }
    } else {
      const amt = parseAmount(r[cols.amountIdx] ?? "");
      if (!amt || amt.value === 0) continue;
      currency ??= amt.currencyHint;
      if (cols.currencyIdx !== -1 && r[cols.currencyIdx]?.trim()) {
        currency ??= r[cols.currencyIdx].trim().toUpperCase().slice(0, 3);
      }
      raw.push({ date, description, signed: amt.value, marker: amt.marker, merchant, bank_category });
    }
  }

  if (raw.length === 0) return null;

  // Sign convention for rows without explicit markers.
  // Prefer inferring from marked rows (e.g. "89.90 DR" ⇒ positive = spending);
  // fall back to majority sign (most statement lines are charges).
  const unmarked = raw.filter((t) => t.marker === null);
  let negativeIsDebit: boolean;
  const marked = raw.filter((t) => t.marker !== null && t.signed !== 0);
  if (marked.length > 0) {
    let negativeDebitVotes = 0;
    for (const t of marked) {
      const rowSaysNegativeIsDebit =
        t.marker === "debit" ? t.signed < 0 : t.signed > 0;
      if (rowSaysNegativeIsDebit) negativeDebitVotes++;
    }
    negativeIsDebit = negativeDebitVotes * 2 >= marked.length;
  } else {
    const negatives = unmarked.filter((t) => t.signed < 0).length;
    negativeIsDebit = negatives * 2 >= unmarked.length;
  }
  if (unmarked.length > 0 && cols.debitIdx === -1) {
    warnings.push(
      `Amount signs interpreted as: ${negativeIsDebit ? "negative" : "positive"} = spending. Verify the debit/credit arrows in the review table.`,
    );
  }

  const transactions: ParsedRow[] = raw.map((t) => {
    let direction: "debit" | "credit";
    if (t.marker) direction = t.marker;
    else if (negativeIsDebit) direction = t.signed < 0 ? "debit" : "credit";
    else direction = t.signed > 0 ? "debit" : "credit";
    return {
      date: t.date,
      description: t.description,
      amount: Math.round(Math.abs(t.signed) * 100) / 100,
      direction,
      merchant: t.merchant,
      bank_category: t.bank_category,
    };
  });

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    period_start: dates[0] ?? null,
    period_end: dates[dates.length - 1] ?? null,
    currency,
    account_hint: null,
    warnings,
  };
}

// ---------------------------------------------------------------- line-oriented parser (PDF text)

/**
 * Parse statement rows from extracted PDF text — one transaction per line:
 *
 *   17/06/26 16/06/26 V8782 SWIM CENTRAL ALBERT PARK 245.00
 *   24/06/26 17/06/26 V9700 TAOBAO Melbourne 33.19 CR
 *   16 Jun 26 BUNNINGS HOPPERS CROSSING 128.78
 *
 * Shape: 1–2 leading dates (when two, the second is the transaction date),
 * an optional card token (V8782), the details, and a trailing amount with an
 * optional CR/DR marker. Credit-card convention: unmarked = charge (debit).
 */
const DATE_TOKEN =
  String.raw`(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-/.][A-Za-z]{3,9}\.?[\s\-/.]\d{2,4})`;
const LINE_RE = new RegExp(
  String.raw`^\s*(${DATE_TOKEN})(?:\s+(${DATE_TOKEN}))?(?:\s+([A-Z]\d{3,4}))?\s+(.+?)\s+\(?(-?)\$?([\d,]+\.\d{2})\)?\s*(CR|DR)?\s*$`,
  "i",
);

function parseStatementLines(text: string): BasicParseResult | null {
  const lines = text.split(/\r?\n/);
  interface Hit {
    dateRaw: string;
    description: string;
    signed: number;
    marker: "debit" | "credit" | null;
  }
  const hits: Hit[] = [];
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, date1, date2, , details, minus, amountRaw, marker] = m;
    const description = details.trim();
    if (/^(opening|closing|previous|brought forward|carried forward|sub ?total|total|balance)\b/i.test(description)) continue;
    const value = Number(amountRaw.replace(/,/g, ""));
    if (!Number.isFinite(value) || value === 0) continue;
    hits.push({
      // With two dates the second is the actual transaction date.
      dateRaw: (date2 ?? date1).trim(),
      description,
      signed: minus ? -value : value,
      marker: marker ? (marker.toUpperCase() === "CR" ? "credit" : "debit") : null,
    });
  }
  if (hits.length < 2) return null;

  const { dayFirst } = detectDayFirst(hits.map((h) => h.dateRaw));
  const transactions: ParsedRow[] = [];
  for (const h of hits) {
    const date = parseDate(h.dateRaw, dayFirst);
    if (!date) continue;
    transactions.push({
      date,
      description: h.description,
      amount: Math.round(Math.abs(h.signed) * 100) / 100,
      direction:
        h.marker ?? (h.signed < 0 ? "credit" : "debit"), // unmarked positive = charge
      merchant: null,
      bank_category: null,
    });
  }
  if (transactions.length < 2) return null;

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    period_start: dates[0] ?? null,
    period_end: dates[dates.length - 1] ?? null,
    currency: null,
    account_hint: null,
    warnings: [],
  };
}

// ---------------------------------------------------------------- multi-line columnar parser (PDF text)

/**
 * Parse statement rows from PDF text where a table's numeric columns get
 * extracted BEFORE its description column — a text-layer ordering quirk
 * seen when "Details" sits visually left of "Money out/in/Balance" but the
 * PDF's content stream emits the numeric cells first — and a transaction's
 * description wraps onto the following lines with no leading date:
 *
 *   01/04/2026 -946.04 28,356.47Internal Transfer - Receipt 807905
 *   Transfer To 200021193
 *   01/04/2026 1,001.16 28,265.93Salary Deposit - Receipt 110435
 *   Heathdale Christ 10435308878679
 *
 * Shape per transaction: DATE, one signed amount (negative = money out,
 * positive = money in), the running balance (immediately followed, with no
 * space, by the description's first line), then zero or more continuation
 * lines until the next date-anchored line. Stops at the first "Total ..."
 * summary line, which reliably marks the end of the transaction table.
 */
const MULTILINE_START_RE = new RegExp(
  String.raw`^(${DATE_TOKEN})\s+(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})(.*)$`,
);
const MULTILINE_NOISE_RE =
  /^(page\s+\d+\s+of\s+\d+|transactions?\s*\(continued\)|date\s+details\s+money out|account name:|e-\d+\s+s-\d+\s+i-\d+)/i;

function parseMultilinePdfStatement(text: string): BasicParseResult | null {
  const lines = text.split(/\r?\n/);
  interface Hit {
    dateRaw: string;
    description: string;
    signed: number;
  }
  const hits: Hit[] = [];
  let current: Hit | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^total\s/i.test(line)) break; // end of the transaction table
    if (MULTILINE_NOISE_RE.test(line)) continue;

    const m = line.match(MULTILINE_START_RE);
    if (m) {
      const [, dateRaw, amountRaw, , descTail] = m;
      const value = Number(amountRaw.replace(/,/g, ""));
      if (!Number.isFinite(value)) continue;
      current = { dateRaw, description: descTail.trim(), signed: value };
      hits.push(current);
    } else if (current) {
      current.description = `${current.description} ${line}`.trim();
    }
  }
  if (hits.length < 2) return null;

  const { dayFirst } = detectDayFirst(hits.map((h) => h.dateRaw));
  const transactions: ParsedRow[] = [];
  for (const h of hits) {
    const date = parseDate(h.dateRaw, dayFirst);
    if (!date || h.signed === 0) continue;
    transactions.push({
      date,
      description: h.description,
      amount: Math.round(Math.abs(h.signed) * 100) / 100,
      direction: h.signed < 0 ? "debit" : "credit",
      merchant: null,
      bank_category: null,
    });
  }
  if (transactions.length < 2) return null;

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    period_start: dates[0] ?? null,
    period_end: dates[dates.length - 1] ?? null,
    currency: null,
    account_hint: null,
    warnings: [],
  };
}

/** Try to find a "Statement Period: X to Y" style line anywhere in the raw text. */
function findStatedPeriod(text: string): { start: string | null; end: string | null } {
  const m = text.match(
    /(?:statement\s+(?:from|period)|period)[:\s]+(.+?)\s+(?:to|-|–|through)\s+(.+?)(?:[\r\n,]|$)/i,
  );
  if (m) {
    const start = parseDate(m[1].trim(), true);
    const end = parseDate(m[2].trim(), true);
    if (start || end) return { start, end };
  }
  // Standalone date-range line, e.g. "16 Jun 26-15 Jul 26" (PDF layouts often
  // separate the "Statement Period" label from its value).
  for (const line of text.split(/\r?\n/)) {
    const r = line.trim().match(
      new RegExp(String.raw`^(${DATE_TOKEN})\s*[-–]\s*(${DATE_TOKEN})$`),
    );
    if (r) {
      const start = parseDate(r[1], true);
      const end = parseDate(r[2], true);
      if (start && end && start <= end) return { start, end };
    }
  }
  return { start: null, end: null };
}

/** Card/account last-4 hint, e.g. "Visa Account Number 4557 0365 8450 9700". */
function findAccountHint(text: string): string | null {
  const m = text.match(/(?:account|card)\s*(?:number|no\.?)?[:\s]+((?:\d[\s-]?){12,19})/i);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-4) : null;
}

export function basicParse(text: string): BasicParseResult | null {
  // Excel exports arrive as "### Sheet: name" sections; plain CSV is one section.
  const sections = text.includes("### Sheet:")
    ? text.split(/^### Sheet:.*$/m).filter((s) => s.trim())
    : [text];

  let best: BasicParseResult | null = null;
  for (const section of sections) {
    const parsed = parseSection(section);
    if (parsed && (!best || parsed.transactions.length > best.transactions.length)) {
      best = parsed;
    }
  }
  // Not a delimited table? Try the line-oriented shape (PDF statement text).
  if (!best) best = parseStatementLines(text);
  // Still nothing? Try the multi-line columnar shape (date+amount+balance on
  // one line, description wrapping onto the lines that follow).
  if (!best) best = parseMultilinePdfStatement(text);
  if (!best) return null;

  const stated = findStatedPeriod(text);
  if (stated.start) best.period_start = stated.start;
  if (stated.end) best.period_end = stated.end;
  best.account_hint ??= findAccountHint(text);

  // Currency from anywhere in the raw text if the amounts carried no symbol.
  if (!best.currency) {
    const m = text.match(/currency[:\s]+([A-Z]{3})/i);
    if (m) best.currency = m[1].toUpperCase();
    else {
      for (const [re, code] of CURRENCY_HINTS) {
        if (re.test(text)) {
          best.currency = code;
          break;
        }
      }
    }
  }
  return best;
}
