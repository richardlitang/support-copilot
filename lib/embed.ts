import { getEmbeddingModel, getOpenAIClient } from "@/lib/openai";

const BATCH_SIZE = 50;

function normalizeEmbeddingInput(text: string) {
  return text.trim().slice(0, 8000);
}

export async function embedTexts(texts: string[]) {
  const client = getOpenAIClient();
  const model = getEmbeddingModel();
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE).map(normalizeEmbeddingInput);
    const response = await client.embeddings.create({
      model,
      input: batch
    });

    embeddings.push(...response.data.map((item) => item.embedding));
  }

  return embeddings;
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);

  if (!embedding) {
    throw new Error("Embedding generation returned no vector.");
  }

  return embedding;
}
