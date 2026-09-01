import "server-only";
import { generateText, jsonSchema, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

// LLM_MODEL format: "anthropic/<id>" | "openai/<id>" | "google/<id>"
// Defaults to Anthropic Sonnet if unset.
function resolveModel(spec: string) {
  const [provider, ...rest] = spec.split("/");
  const id = rest.join("/");
  if (provider === "openai") return openai(id);
  if (provider === "google") return google(id);
  return anthropic(id || spec); // ponytail: bare IDs fall through to Anthropic
}

const MODEL = resolveModel(process.env.LLM_MODEL ?? "anthropic/claude-sonnet-4-6");

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
