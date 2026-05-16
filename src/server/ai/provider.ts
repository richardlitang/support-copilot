import { getRuntimeConfig } from "@/lib/env";
import { getAnswerModel, getEmbeddingModel, getOpenAIClient } from "@/lib/openai";

const MOCK_EMBEDDING_DIMENSIONS = 1536;

type AiTextMessage = {
  role: "system" | "user";
  content: Array<{
    type: "input_text";
    text: string;
  }>;
};

export type StructuredJsonRequest = {
  messages: AiTextMessage[];
  schema: {
    readonly name: string;
    readonly schema: {
      readonly [key: string]: unknown;
    };
    readonly strict?: boolean;
  };
  emptyResponseMessage: string;
};

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

export function createMockEmbedding(text: string) {
  const normalizedInput = text.trim().slice(0, 8000);
  const vector = new Array<number>(MOCK_EMBEDDING_DIMENSIONS).fill(0);
  let hash = 2166136261;

  for (let index = 0; index < normalizedInput.length; index += 1) {
    hash ^= normalizedInput.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  for (let index = 0; index < MOCK_EMBEDDING_DIMENSIONS; index += 1) {
    hash ^= index;
    hash = Math.imul(hash, 16777619);
    vector[index] = ((hash >>> 0) % 2000) / 1000 - 1;
  }

  return normalizeVector(vector);
}

export async function createEmbeddings(texts: string[]) {
  const provider = getRuntimeConfig().aiProvider;

  if (provider === "mock") {
    return texts.map(createMockEmbedding);
  }

  if (provider === "ollama") {
    throw new Error("AI_PROVIDER=ollama is not implemented in Milestone 1.");
  }

  const client = getOpenAIClient();
  const model = getEmbeddingModel();
  const embeddings: number[][] = [];
  const batchSize = 50;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize).map((text) => text.trim().slice(0, 8000));
    const response = await client.embeddings.create({
      model,
      input: batch,
    });

    embeddings.push(...response.data.map((item) => item.embedding));
  }

  return embeddings;
}

export async function createStructuredJsonResponse<T>(input: StructuredJsonRequest) {
  const provider = getRuntimeConfig().aiProvider;

  if (provider === "mock") {
    throw new Error("Mock structured responses must be supplied by the caller.");
  }

  if (provider === "ollama") {
    throw new Error("Structured responses are not implemented for AI_PROVIDER=ollama.");
  }

  const client = getOpenAIClient();
  const model = getAnswerModel();
  const response = await client.responses.create({
    model,
    input: input.messages,
    text: {
      format: {
        type: "json_schema",
        name: input.schema.name,
        strict: input.schema.strict,
        schema: input.schema.schema,
      },
    },
  });

  const outputText = response.output_text;

  if (!outputText) {
    throw new Error(input.emptyResponseMessage);
  }

  return JSON.parse(outputText) as T;
}
