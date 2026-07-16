import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, MODEL } from "./client";
import { buildExtractionSchema, ExtractionResult } from "./schema";
import { buildSystemPrompt } from "./prompt";
import { Category } from "@/lib/types";
import { IntakeResult } from "@/lib/files/intake";

export class ExtractionError extends Error {
  constructor(
    public code:
      | "TOO_MANY_TRANSACTIONS"
      | "EXTRACTION_FAILED"
      | "NOT_A_STATEMENT"
      | "UNREADABLE"
      | "BASIC_PARSE_FAILED"
      | "BASIC_NEEDS_TEXT",
    message: string,
  ) {
    super(message);
  }
}

const INSTRUCTION =
  "Extract every transaction from this statement following your instructions.";

function buildContentBlocks(
  input: Exclude<IntakeResult, { kind: "error" }>,
): Anthropic.ContentBlockParam[] {
  switch (input.kind) {
    case "pdf":
      return [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: input.buffer.toString("base64"),
          },
        },
        { type: "text", text: INSTRUCTION },
      ];
    case "image":
      return [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: input.mediaType,
            data: input.buffer.toString("base64"),
          },
        },
        { type: "text", text: INSTRUCTION },
      ];
    case "text":
      return [
        {
          type: "text",
          text: `Statement file "${input.label}" content:\n\n${input.text}\n\n---\n\n${INSTRUCTION}`,
        },
      ];
  }
}

export async function extractStatement(
  input: Exclude<IntakeResult, { kind: "error" }>,
  categories: Category[],
  rules: Map<string, string>,
): Promise<ExtractionResult> {
  const client = getAnthropic();
  const categoryNames = categories.map((c) => c.name);
  const schema = buildExtractionSchema(categoryNames);

  // Streaming is required at this max_tokens (the SDK rejects non-streaming
  // requests that could exceed HTTP timeouts). Structured outputs still
  // guarantee schema-valid JSON in the final text block.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    // Explicit — omitting `thinking` runs WITHOUT thinking on this model.
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(categories, rules),
    messages: [{ role: "user", content: buildContentBlocks(input) }],
    output_config: { format: zodOutputFormat(schema) },
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "max_tokens") {
    throw new ExtractionError(
      "TOO_MANY_TRANSACTIONS",
      "This statement is too large to process in one go. Split the file (e.g. by month) and upload the parts separately.",
    );
  }
  if (response.stop_reason === "refusal") {
    throw new ExtractionError(
      "EXTRACTION_FAILED",
      "The AI declined to process this document. Try a clearer export of the statement.",
    );
  }

  // finalMessage() has no parsed_output — validate the guaranteed-JSON text
  // block against the same Zod schema ourselves.
  const text = response.content.find((b) => b.type === "text")?.text;
  const validated = text
    ? schema.safeParse(JSON.parse(text))
    : ({ success: false } as const);
  if (!validated.success) {
    throw new ExtractionError(
      "EXTRACTION_FAILED",
      "Could not parse the statement. Try again, or upload a different export format.",
    );
  }
  const parsed: ExtractionResult = validated.data;

  if (parsed.document_status === "not_a_statement") {
    throw new ExtractionError(
      "NOT_A_STATEMENT",
      "This file doesn't look like a bank or credit card statement.",
    );
  }
  if (parsed.document_status === "unreadable") {
    throw new ExtractionError(
      "UNREADABLE",
      "The statement is too blurry or truncated to read. Try a higher-quality export or photo.",
    );
  }

  // Belt-and-braces: enforce the schema's cross-field contract.
  for (const t of parsed.transactions) {
    if (
      t.proposed_category !== null &&
      !categoryNames.includes(t.proposed_category)
    ) {
      t.proposed_category = null;
    }
    if (t.proposed_category === null) t.needs_review = true;
  }

  return parsed;
}
