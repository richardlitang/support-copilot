import type { EvidenceChunk } from "@/lib/types";

export function mergeRetrievalCandidates(candidates: EvidenceChunk[]) {
  const byChunk = new Map<string, EvidenceChunk>();

  for (const candidate of candidates) {
    const existing = byChunk.get(candidate.id);

    if (!existing) {
      byChunk.set(candidate.id, {
        ...candidate,
        retrievalSource: candidate.retrievalSource ?? "vector",
        vectorScore:
          candidate.vectorScore ??
          (candidate.retrievalSource === "literal" ? undefined : candidate.score),
        literalMatches: candidate.literalMatches ?? [],
      });
      continue;
    }

    const existingSource = existing.retrievalSource ?? "vector";
    const nextSource = candidate.retrievalSource ?? "vector";
    const literalMatches = Array.from(
      new Set([...(existing.literalMatches ?? []), ...(candidate.literalMatches ?? [])]),
    );
    const vectorScore =
      existing.vectorScore ??
      candidate.vectorScore ??
      (nextSource === "vector" || nextSource === "hybrid" ? candidate.score : undefined);

    byChunk.set(candidate.id, {
      ...existing,
      score: Math.max(existing.score, candidate.score),
      retrievalSource: existingSource === nextSource ? existingSource : "hybrid",
      vectorScore,
      literalMatches,
    });
  }

  return Array.from(byChunk.values())
    .sort((left, right) => right.score - left.score)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
}

export function applyRerankScores(
  candidates: EvidenceChunk[],
  scores: Array<{ index: number; score: number }>,
) {
  const byIndex = new Map(scores.map((item) => [item.index, item.score]));

  return candidates
    .map((candidate, index) => {
      const rerankScore = byIndex.get(index);

      return {
        ...candidate,
        score: rerankScore ?? candidate.score,
        rerankScore,
      };
    })
    .sort((left, right) => {
      if (left.rerankScore !== undefined && right.rerankScore !== undefined) {
        return right.rerankScore - left.rerankScore;
      }

      if (left.rerankScore !== undefined) {
        return -1;
      }

      if (right.rerankScore !== undefined) {
        return 1;
      }

      return right.score - left.score;
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
}
