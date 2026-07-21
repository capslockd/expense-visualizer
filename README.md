# Expense Visualizer

Upload a credit card or bank statement (PDF, CSV/Excel, or a photo), and the
app extracts every transaction with Claude, categorizes each one, and shows
you which category is eating your money — per statement and month over month.

**The core rule: nothing stays uncategorized.** There is no "Miscellaneous"
bucket anywhere in the app. When the AI isn't confident about a line, you're
asked to pick the category before the statement can be saved — and your answer
is remembered (per merchant), so the app asks less and less over time.

Accounts are supported (email/password and/or Google sign-in); every
statement, transaction, rule, and category belongs to the account that
created it. All data lives in your own Google Sheet — no database.

## How it works

1. **Sign in** → your account row lives in the `Users` tab of the sheet.
2. **Upload** a statement → Claude (`claude-opus-4-8`) extracts every
   transaction with a structured-output schema. Your saved merchant→category
   rules are applied automatically; anything the AI can't confidently place is
   flagged for review.
   - **No AI credits? Use Basic parsing.** The upload screen has a
     "Basic parsing (no AI)" option that reads CSV/Excel exports **and
     text-based PDF statements** (e.g. NAB card statements) deterministically
     and categorizes by a built-in merchant-keyword dictionary plus your
     learned rules — everything else is flagged for you to categorize by
     hand. If AI parsing fails because the Anthropic account has no credits,
     the app falls back to Basic automatically. Scanned/photographed
     statements still need AI (they have no text layer to read).
   - **Tuned for Australia.** The keyword dictionary covers Australian
     merchants (Woolworths, Coles, Bunnings, Opal/Myki, Linkt, AGL, Telstra,
     Medibank, …) plus global brands; ambiguous dates are read as DD/MM, and
     undetected currency defaults to AUD. Coles Express counts as fuel
     (Transport), not groceries, and BPAY payments to a recognizable biller
     get the biller's category.
3. **Review** → amber rows need your decision; Save stays disabled until every
   transaction has a category. "Remember this merchant" (on by default) turns
   your choices into rules for next time.
4. **Save** → rows are appended to your Google Sheet (`Transactions`,
   `CategoryRules`, then a `Statements` commit row).
5. **Three dashboards** → **Expense Dashboard** (most-expensive category per
   statement, monthly trend by category, budget vs actual, top merchants),
   **Income Dashboard** (the same shape, for income categories — Salary,
   Business, eBay, Website, and more), and **Income vs Expenditure**
   (income vs expenses side by side per statement/month, with the surplus or
   shortfall called out).

## Setup

### 1. Anthropic API key

[console.anthropic.com](https://console.anthropic.com) → API keys → create one
→ put it in `.env.local` as `ANTHROPIC_API_KEY`.

### 2. Google Sheet + service account (the datastore)

1. Create (or reuse) a blank Google Sheet — e.g. **AI Budgetter**.
2. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project (e.g. `ai-budgetter`).
3. **APIs & Services → Library** → enable **Google Sheets API**.
4. **IAM & Admin → Service Accounts → Create** (no roles needed) →
   **Keys → Add key → JSON** → download the file.
5. Encode the key file and put it in `.env.local`:
   ```sh
   base64 -i ~/Downloads/your-key.json | pbcopy
   # paste as GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
   ```
6. Open the sheet → **Share** → add the service account's `client_email`
   (found inside the JSON) as **Editor**.
7. Copy the spreadsheet ID from the sheet URL (the long token between `/d/`
   and `/edit`) → `GOOGLE_SPREADSHEET_ID`.

### 3. Auth

`AUTH_SECRET` is already generated in `.env.local` (or run
`openssl rand -base64 32`).

**Google sign-in (optional — email/password works without it):** in the same
GCP project → **APIs & Services → OAuth consent screen** (External; add
yourself as a test user) → **Credentials → Create OAuth client ID → Web
application** → authorized redirect URI
`http://localhost:3000/api/auth/callback/google` → copy the client ID/secret
into `.env.local`. If these are unset, the Google button simply doesn't
render.

### 4. Run

```sh
npm install
npm run bootstrap   # creates the 5 tabs + headers in your sheet (idempotent)
npm run build && npm start   # http://localhost:3000
```

> **Why `build && start` instead of `npm run dev`?** Next 16's Turbopack dev
> mode currently crashes the two chart pages (`/dashboard`,
> `/dashboard/statements/[id]`) with an RSC serialization bug
> ("ArrayBuffer is not detachable"). The production build renders them fine.
> `npm run dev` still works for developing everything else.

## The Google Sheet schema

| Tab | Columns |
|---|---|
| `Users` | id, email, name, password_hash, auth_provider, created_at |
| `Statements` | id, user_id, uploaded_at, period_start, period_end, source_filename, currency, total_debits, total_credits, transaction_count, content_hash |
| `Transactions` | id, user_id, statement_id, date, description, merchant, merchant_normalized, amount, direction, currency, category, categorized_by |
| `CategoryRules` | user_id, merchant_normalized, category, created_at |
| `Categories` | user_id, name, monthly_budget, created_at, type |

- Default categories are seeded **per user** on first use — 13 expense
  categories, Payments & Transfers, and 8 income categories (Salary,
  Business, eBay, Website, Government Benefits, Interest & Cashback, Tax
  Refunds, Income & Refunds). Add your own from the review screen — pick
  Expense or Income, and catch-all names (Miscellaneous, Other, …) are
  rejected. A transaction's income/expense classification is entirely
  determined by which category it's assigned — there's no separate flag to
  fall out of sync.
- **Budgets:** put a number in the `monthly_budget` column of `Categories`
  and the dashboard's budget-vs-actual section fills in.
- Amounts are always positive; `direction` (debit/credit) carries the sign.
- The `Statements` row is written last during a save, so a crash mid-save
  leaves only orphaned rows that the app ignores.

## Expense & income semantics

- **Payments & Transfers** (card payments, transfers) are excluded from all
  analytics entirely — paying your card bill isn't spending or income.
- Every other category is typed **expense** or **income**. A refund of an
  identifiable purchase keeps the purchase's (expense) category and
  *subtracts* from it — it never becomes income. A correction against an
  income category (e.g. a clawed-back deposit) works the same way in reverse.
- The Expense Dashboard only ever shows expense-typed categories; the Income
  Dashboard only ever shows income-typed ones. Income vs Expenditure compares
  the two totals per statement/month.
- Multi-currency: amounts are the billed value in the statement currency; if
  your sheet accumulates more than one currency, the dashboards get a currency
  toggle. No FX conversion (out of scope).

## Notes & limits

- Files up to 20MB; PDFs, CSV/TSV, Excel (.xls/.xlsx), PNG/JPEG/WebP/GIF.
- Password-protected PDFs are detected and rejected with a clear message —
  remove the password (e.g. print to PDF) first.
- Duplicate uploads are detected by content (period + transactions), warned
  about, and blocked unless you choose "Save anyway".
- Very large statements that exceed the extraction budget fail cleanly with a
  "split the file" message rather than silently truncating.
- Password reset isn't implemented (no email service in v1) — if you signed up
  with a password and forgot it, sign in with Google using the same email.
