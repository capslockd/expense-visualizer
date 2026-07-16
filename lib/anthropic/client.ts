import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
    }
    client = new Anthropic();
  }
  return client;
}
