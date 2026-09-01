import "server-only";
import { generateText, jsonSchema, Output } from "ai";

// All LLM calls route through the AI Gateway: one key (AI_GATEWAY_API_KEY),
// any provider. Switch models with LLM_MODEL, e.g. "anthropic/claude-opus-5",
// "openai/gpt-5.2", "google/gemini-3-pro" — no code changes.
const MODEL = process.env.LLM_MODEL ?? "anthropic/claude-opus-5";

export async function generateStructured<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const { output } = await generateText({
    model: MODEL,
    system: opts.system,
    prompt: opts.prompt,
    output: Output.object({ schema: jsonSchema<T>(opts.schema) }),
  });
  return output as T;
}

export async function generatePlainText(opts: {
  system: string;
  prompt: string;
}): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    system: opts.system,
    prompt: opts.prompt,
  });
  return text.trim();
}
