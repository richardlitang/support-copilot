import { matchDocumentChunks, matchLiteralDocumentChunks } from "@/lib/db";
import { embedText } from "@/lib/embed";
import { extractLikelyLiterals } from "@/lib/literal-retrieval";
import { rerankEvidenceCandidates } from "@/lib/rerank";
import { applyRerankScores, mergeRetrievalCandidates } from "@/lib/retrieval-candidates";

const DEFAULT_TOP_K = 8;
const DEFAULT_CANDIDATE_TOP_K = 30;
const DEFAULT_LITERAL_TOP_K = 20;

export function getRetrievalLimit() {
  const rawTopK = process.env.SUPPORT_RETRIEVAL_TOP_K;
  const parsed = rawTopK ? Number(rawTopK) : DEFAULT_TOP_K;
  const normalized = Number.isFinite(parsed) ? parsed : DEFAULT_TOP_K;

  return Math.min(Math.max(Math.round(normalized), 3), 12);
}

export function getRetrievalCandidateLimit() {
  const rawTopK = process.env.SUPPORT_RETRIEVAL_CANDIDATE_TOP_K;
  const parsed = rawTopK ? Number(rawTopK) : DEFAULT_CANDIDATE_TOP_K;
  const normalized = Number.isFinite(parsed) ? parsed : DEFAULT_CANDIDATE_TOP_K;

  return Math.min(Math.max(Math.round(normalized), 8), 40);
}

export function getMatchThreshold() {
  const rawThreshold = process.env.SUPPORT_MATCH_THRESHOLD;
  const parsed = rawThreshold ? Number(rawThreshold) : 0.46;
  const normalized = Number.isFinite(parsed) ? parsed : 0.46;

  return Math.min(Math.max(normalized, 0), 0.8);
}

export async function retrieveEvidence(input: { question: string; sessionId: string; limit?: number }) {
  const finalLimit = input.limit ?? getRetrievalLimit();
  const candidateLimit = Math.max(getRetrievalCandidateLimit(), finalLimit);
  const queryEmbedding = await embedText(input.question);
  const vectorCandidates = await matchDocumentChunks({
    sessionId: input.sessionId,
    queryEmbedding,
    matchCount: candidateLimit,
    matchThreshold: getMatchThreshold()
  });
  const literals = extractLikelyLiterals(input.question);
  const literalCandidates = literals.length
    ? await matchLiteralDocumentChunks({
        sessionId: input.sessionId,
        literals,
        matchCount: DEFAULT_LITERAL_TOP_K
      })
    : [];
  const candidates = mergeRetrievalCandidates([
    ...literalCandidates,
    ...vectorCandidates.map((candidate) => ({
      ...candidate,
      retrievalSource: "vector" as const,
      vectorScore: candidate.score
    }))
  ]);

  try {
    const rerankScores = await rerankEvidenceCandidates({
      query: input.question,
      candidates,
      topN: finalLimit
    });

    if (rerankScores.length) {
      return applyRerankScores(candidates, rerankScores).slice(0, finalLimit);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(error instanceof Error ? error.message : "Rerank request failed.");
    }
  }

  return candidates.slice(0, finalLimit).map((candidate, index) => ({
    ...candidate,
    rank: index + 1
  }));
}
