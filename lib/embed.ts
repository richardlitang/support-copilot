import { createEmbeddings } from "@/src/server/ai/provider";

export async function embedTexts(texts: string[]) {
  return createEmbeddings(texts);
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);

  if (!embedding) {
    throw new Error("Embedding generation returned no vector.");
  }

  return embedding;
}
