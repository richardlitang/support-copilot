import OpenAI from "openai";
import { ensureEnvLoaded } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  ensureEnvLoaded();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  client ??= new OpenAI({ apiKey });
  return client;
}

export function getEmbeddingModel() {
  ensureEnvLoaded();
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

export function getAnswerModel() {
  ensureEnvLoaded();
  return process.env.OPENAI_ANSWER_MODEL ?? "gpt-4o-mini";
}
