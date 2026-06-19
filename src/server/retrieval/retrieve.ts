import {
  matchDocumentChunksDb as matchDocumentChunks,
  matchFtsDocumentChunksDb as matchFtsDocumentChunks,
  matchLiteralDocumentChunksDb as matchLiteralDocumentChunks,
} from "@/src/server/db/retrieval";
import { embedText } from "@/src/server/ai/embed";
import { extractExactCodeLiterals } from "@/lib/literal-retrieval";
import { rerankEvidenceCandidates } from "@/src/server/ai/rerank";
import {
  applyRerankScores,
  fuseRetrievalCandidatesWithRrf,
  selectRerankerInputCandidates,
} from "@/lib/retrieval-candidates";
import type { RetrievalBoundaryTrace } from "@/lib/types";
import { captureServerException } from "@/src/server/observability/sentry";

const DEFAULT_TOP_K = 8;
const DEFAULT_CANDIDATE_TOP_K = 30;
const DEFAULT_RERANK_CANDIDATE_LIMIT = 50;
const DEFAULT_PINNED_EXACT_CANDIDATE_LIMIT = 5;
const DEFAULT_FTS_CANDIDATE_LIMIT = 30;

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

function getBoundedPositiveInteger(key: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[key]);
  const normalized = Number.isFinite(parsed) ? parsed : fallback;

  return Math.min(Math.max(Math.round(normalized), min), max);
}

export function getRerankCandidateLimit() {
  return getBoundedPositiveInteger(
    "SUPPORT_RERANK_CANDIDATE_LIMIT",
    DEFAULT_RERANK_CANDIDATE_LIMIT,
    8,
    100,
  );
}

export function getPinnedExactCandidateLimit() {
  return getBoundedPositiveInteger(
    "SUPPORT_PINNED_EXACT_CANDIDATE_LIMIT",
    DEFAULT_PINNED_EXACT_CANDIDATE_LIMIT,
    1,
    20,
  );
}

export function getFtsCandidateLimit() {
  return getBoundedPositiveInteger(
    "SUPPORT_FTS_CANDIDATE_LIMIT",
    DEFAULT_FTS_CANDIDATE_LIMIT,
    8,
    50,
  );
}

export function getMatchThreshold() {
  const rawThreshold = process.env.SUPPORT_MATCH_THRESHOLD;
  const parsed = rawThreshold ? Number(rawThreshold) : 0.46;
  const normalized = Number.isFinite(parsed) ? parsed : 0.46;

  return Math.min(Math.max(normalized, 0), 0.8);
}

export async function retrieveEvidence(input: {
  question: string;
  sessionId: string;
  limit?: number;
  onTrace?: (trace: RetrievalBoundaryTrace) => void;
}) {
  const finalLimit = input.limit ?? getRetrievalLimit();
  const candidateLimit = Math.max(getRetrievalCandidateLimit(), finalLimit);
  const queryEmbedding = await embedText(input.question);
  const vectorCandidates = await matchDocumentChunks({
    sessionId: input.sessionId,
    queryEmbedding,
    matchCount: candidateLimit,
    matchThreshold: getMatchThreshold(),
  });
  const exactLiterals = extractExactCodeLiterals(input.question);
  const literalCandidates = exactLiterals.length
    ? await matchLiteralDocumentChunks({
        sessionId: input.sessionId,
        literals: exactLiterals,
        matchCount: getPinnedExactCandidateLimit(),
      })
    : [];
  const ftsCandidates = await matchFtsDocumentChunks({
    sessionId: input.sessionId,
    query: input.question,
    matchCount: getFtsCandidateLimit(),
  });
  const contestableCandidates = fuseRetrievalCandidatesWithRrf([
    {
      lane: "vector",
      candidates: vectorCandidates.map((candidate) => ({
        ...candidate,
        retrievalSource: "vector" as const,
        vectorScore: candidate.score,
      })),
    },
    { lane: "fts", candidates: ftsCandidates },
  ]);
  const rerankerInputCandidates = selectRerankerInputCandidates({
    exactCandidates: literalCandidates,
    contestableCandidates,
    limit: getRerankCandidateLimit(),
    pinnedExactLimit: getPinnedExactCandidateLimit(),
  });

  let finalCandidates = rerankerInputCandidates.slice(0, finalLimit).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));

  try {
    const rerankScores = await rerankEvidenceCandidates({
      query: input.question,
      candidates: rerankerInputCandidates,
      topN: finalLimit,
    });

    if (rerankScores.length) {
      finalCandidates = applyRerankScores(rerankerInputCandidates, rerankScores).slice(
        0,
        finalLimit,
      );
    }
  } catch (error) {
    captureServerException(error, { tags: { route: "retrieval:rerank" } });
    if (process.env.NODE_ENV !== "production") {
      console.warn(error instanceof Error ? error.message : "Rerank request failed.");
    }
  }

  input.onTrace?.({
    query: input.question,
    exactTerms: exactLiterals,
    ftsQuery: input.question,
    pinnedCandidateIds: rerankerInputCandidates
      .filter((candidate) => candidate.exactPinned)
      .map((candidate) => candidate.id),
    rerankerInputCandidateIds: rerankerInputCandidates.map((candidate) => candidate.id),
    finalCandidateIds: finalCandidates.map((candidate) => candidate.id),
    rerankerInputCandidates,
    finalCandidates,
  });

  return finalCandidates;
}
