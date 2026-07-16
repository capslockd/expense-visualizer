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
3. **Review** → amber rows need your decision; Save stays disabled until every
   transaction has a category. "Remember this merchant" (on by default) turns
   your choices into rules for next time.
4. **Save** → rows are appended to your Google Sheet (`Transactions`,
   `CategoryRules`, then a `Statements` commit row).
5. **Dashboard** → most-expensive category per statement, monthly trend by
   category, budget vs actual, top merchants.

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
npm run dev         # http://localhost:3000
```

## The Google Sheet schema

| Tab | Columns |
|---|---|
| `Users` | id, email, name, password_hash, auth_provider, created_at |
| `Statements` | id, user_id, uploaded_at, period_start, period_end, source_filename, currency, total_debits, total_credits, transaction_count, content_hash |
| `Transactions` | id, user_id, statement_id, date, description, merchant, merchant_normalized, amount, direction, currency, category, categorized_by |
| `CategoryRules` | user_id, merchant_normalized, category, created_at |
| `Categories` | user_id, name, monthly_budget, created_at |

- Default categories are seeded **per user** on first use. Add your own from
  the review screen — catch-all names (Miscellaneous, Other, …) are rejected.
- **Budgets:** put a number in the `monthly_budget` column of `Categories`
  and the dashboard's budget-vs-actual section fills in.
- Amounts are always positive; `direction` (debit/credit) carries the sign.
- The `Statements` row is written last during a save, so a crash mid-save
  leaves only orphaned rows that the app ignores.

## Expense semantics

- **Payments & Transfers** (card payments, transfers) are excluded from all
  analytics — paying your card bill isn't spending.
- A refund of an identifiable purchase keeps the purchase's category and
  *subtracts* from it (net spend).
- Other incoming money goes to **Income & Refunds**, shown as "money in" and
  excluded from expense charts.
- Multi-currency: amounts are the billed value in the statement currency; if
  your sheet accumulates more than one currency, the dashboard gets a currency
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
