import { google, sheets_v4 } from "googleapis";

let sheets: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (!sheets) {
    const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
    if (!keyB64) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set. See .env.example for setup steps.",
      );
    }
    const credentials = JSON.parse(
      Buffer.from(keyB64, "base64").toString("utf8"),
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheets = google.sheets({ version: "v4", auth });
  }
  return sheets;
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_SPREADSHEET_ID is not set. Copy it from the sheet URL (between /d/ and /edit).",
    );
  }
  return id;
}
