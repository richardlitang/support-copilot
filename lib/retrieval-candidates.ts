import type { EvidenceChunk } from "@/lib/types";

export function selectRerankerInputCandidates(input: {
  exactCandidates: EvidenceChunk[];
  contestableCandidates: EvidenceChunk[];
  limit: number;
  pinnedExactLimit: number;
}) {
  const selected = new Map<string, EvidenceChunk>();
  const pinned = input.exactCandidates.slice(0, Math.min(input.pinnedExactLimit, input.limit));

  for (const candidate of pinned) {
    selected.set(candidate.id, {
      ...candidate,
      exactPinned: true,
      retrievalSource: candidate.retrievalSource ?? "exact",
    });
  }

  for (const candidate of input.contestableCandidates) {
    if (selected.size >= input.limit) {
      break;
    }

    if (!selected.has(candidate.id)) {
      selected.set(candidate.id, candidate);
    }
  }

  return Array.from(selected.values()).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}

export function fuseRetrievalCandidatesWithRrf(
  lanes: Array<{ lane: "vector" | "fts"; candidates: EvidenceChunk[] }>,
  rrfK = 60,
): EvidenceChunk[] {
  const byId = new Map<
    string,
    EvidenceChunk & { rrfScore: number; laneNames: Set<"vector" | "fts"> }
  >();

  for (const lane of lanes) {
    lane.candidates.forEach((candidate, index) => {
      const contribution = 1 / (rrfK + index + 1);
      const existing = byId.get(candidate.id);

      if (existing) {
        existing.rrfScore += contribution;
        existing.laneNames.add(lane.lane);
        return;
      }

      byId.set(candidate.id, {
        ...candidate,
        rrfScore: contribution,
        laneNames: new Set([lane.lane]),
      });
    });
  }

  return Array.from(byId.values())
    .sort((left, right) => right.rrfScore - left.rrfScore)
    .map((candidate, index): EvidenceChunk => ({
      ...candidate,
      score: candidate.rrfScore,
      retrievalSource:
        candidate.laneNames.size > 1
          ? "hybrid"
          : (Array.from(candidate.laneNames)[0] as "vector" | "fts"),
      rank: index + 1,
    }));
}

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
