import { matchDocumentChunks } from "@/lib/db";
import { embedText } from "@/lib/embed";

const DEFAULT_TOP_K = 8;

export function getRetrievalLimit() {
  const rawTopK = process.env.SUPPORT_RETRIEVAL_TOP_K;
  const parsed = rawTopK ? Number(rawTopK) : DEFAULT_TOP_K;
  const normalized = Number.isFinite(parsed) ? parsed : DEFAULT_TOP_K;

  return Math.min(Math.max(Math.round(normalized), 3), 12);
}

export function getMatchThreshold() {
  const rawThreshold = process.env.SUPPORT_MATCH_THRESHOLD;
  const parsed = rawThreshold ? Number(rawThreshold) : 0.46;
  const normalized = Number.isFinite(parsed) ? parsed : 0.46;

  return Math.min(Math.max(normalized, 0), 0.8);
}

export async function retrieveEvidence(input: { question: string; sessionId: string; limit?: number }) {
  const limit = input.limit ?? getRetrievalLimit();
  const queryEmbedding = await embedText(input.question);

  return matchDocumentChunks({
    sessionId: input.sessionId,
    queryEmbedding,
    matchCount: limit,
    matchThreshold: getMatchThreshold()
  });
}
