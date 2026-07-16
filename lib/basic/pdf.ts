import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract line-oriented text from a (text-based) PDF statement.
 * Returns null when the PDF has no usable text layer — i.e. it's a scan,
 * which only the AI engine can read.
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = text as unknown as string[];
  const joined = pages.join("\n");
  // A scanned statement yields near-zero extractable characters.
  const letters = joined.replace(/[^A-Za-z0-9]/g, "").length;
  if (letters < 200) return null;
  return joined;
}
