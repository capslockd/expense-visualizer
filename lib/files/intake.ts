import * as XLSX from "xlsx";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // keeps base64 well under the 32MB API limit

export type IntakeResult =
  | { kind: "pdf"; buffer: Buffer }
  | { kind: "image"; mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; buffer: Buffer }
  | { kind: "text"; text: string; label: string }
  | { kind: "error"; code: "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE" | "PDF_PASSWORD_PROTECTED"; message: string };

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function isEncryptedPdf(buf: Buffer): boolean {
  // The /Encrypt entry lives in the trailer dictionary; scanning the raw bytes
  // is a reliable pre-flight without a PDF parser.
  return buf.includes("/Encrypt");
}

function looksTextual(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128) {
      printable++;
    }
  }
  return sample.length > 0 && printable / sample.length > 0.97;
}

function spreadsheetToCsvText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sections = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    return `### Sheet: ${name}\n${csv}`;
  });
  return sections.join("\n\n");
}

export function intakeFile(buffer: Buffer, filename: string): IntakeResult {
  if (buffer.length === 0) {
    return { kind: "error", code: "UNSUPPORTED_TYPE", message: "The file is empty." };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return {
      kind: "error",
      code: "FILE_TOO_LARGE",
      message: "File is larger than 20MB. Export a smaller statement or split it.",
    };
  }

  // PDF
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
    if (isEncryptedPdf(buffer)) {
      return {
        kind: "error",
        code: "PDF_PASSWORD_PROTECTED",
        message:
          "This PDF is password-protected. Remove the password (e.g. print to PDF) and upload again.",
      };
    }
    return { kind: "pdf", buffer };
  }

  // Images
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) {
    return { kind: "image", mediaType: "image/png", buffer };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { kind: "image", mediaType: "image/jpeg", buffer };
  }
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return { kind: "image", mediaType: "image/gif", buffer };
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { kind: "image", mediaType: "image/webp", buffer };
  }

  // Spreadsheets: .xlsx (zip) and legacy .xls (compound file)
  const isZip = startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  const isCfb = startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]);
  if (isZip || isCfb) {
    try {
      return { kind: "text", text: spreadsheetToCsvText(buffer), label: filename };
    } catch {
      return {
        kind: "error",
        code: "UNSUPPORTED_TYPE",
        message: "Could not read this spreadsheet file. Export it as CSV and try again.",
      };
    }
  }

  // CSV / plain text
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["csv", "txt", "tsv"].includes(ext) || looksTextual(buffer)) {
    return { kind: "text", text: buffer.toString("utf8"), label: filename };
  }

  return {
    kind: "error",
    code: "UNSUPPORTED_TYPE",
    message: "Unsupported file type. Upload a PDF, CSV, Excel file, or an image.",
  };
}
