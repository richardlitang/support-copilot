import type { EvidenceChunk } from "@/lib/types";

/**
 * The relevance signal used by routing and review gates.
 *
 * Retrieval fuses vector and full-text lanes with Reciprocal Rank Fusion, which
 * overwrites each chunk's `score` with a rank-fusion ordering value (~0.03 max at
 * rrfK=60). The optional Cohere reranker then overwrites `score` again with a real
 * 0-1 relevance score — but when no reranker is configured, the RRF ordering value
 * survives as `score`. Strength thresholds are calibrated to relevance scale
 * (cosine / rerank), not to the fusion ordering scale, so gates must read the best
 * calibrated signal a chunk carries rather than its raw `score`.
 *
 * Preference order:
 *   1. `rerankScore` — reranker relevance (0-1), most trustworthy when present
 *   2. `vectorScore` — dense cosine similarity, retained through fusion for
 *      vector-originated chunks
 *   3. `score` — raw fallback (exact-literal pins carry a calibrated `score` and no
 *      cosine; FTS-only chunks fall back to the fusion ordering value)
 */
export function calibratedRelevance(
  chunk: Pick<EvidenceChunk, "score" | "vectorScore" | "rerankScore">,
): number {
  return chunk.rerankScore ?? chunk.vectorScore ?? chunk.score;
}
