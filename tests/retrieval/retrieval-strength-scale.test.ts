import { describe, expect, it } from "vitest";
import { fuseRetrievalCandidatesWithRrf } from "@/lib/retrieval-candidates";
import { summarizeRetrievalStrength } from "@/lib/classify";
import { determineSupportLevel } from "@/lib/support-level";
import { calibratedRelevance } from "@/lib/retrieval-strength";
import type { EvidenceChunk } from "@/lib/types";

function chunk(overrides: Partial<EvidenceChunk> & { id: string }): EvidenceChunk {
  return {
    documentId: "doc-1",
    filename: "paybridge-guide.md",
    sectionTitle: "Webhooks",
    content: "Rotate the webhook signing secret from Settings.",
    score: 0,
    rank: 1,
    chunkIndex: 0,
    ...overrides,
  };
}

// A perfect retrieval: the correct chunk ranks #1 in both the vector and FTS lanes
// with an excellent 0.9 cosine similarity. After RRF fusion, `score` becomes the
// low rank-fusion ordering value (~0.03) while `vectorScore` retains the cosine.
function fusedStrongTopHit(): EvidenceChunk[] {
  return fuseRetrievalCandidatesWithRrf([
    {
      lane: "vector",
      candidates: [
        chunk({ id: "A", score: 0.9, retrievalSource: "vector", vectorScore: 0.9 }),
        chunk({
          id: "B",
          score: 0.8,
          rank: 2,
          chunkIndex: 1,
          retrievalSource: "vector",
          vectorScore: 0.8,
        }),
      ],
    },
    {
      lane: "fts",
      candidates: [chunk({ id: "A", score: 0.09, retrievalSource: "fts" })],
    },
  ]);
}

describe("retrieval strength score scale", () => {
  it("preserves the cosine signal on the fused ordering score (guard)", () => {
    const evidence = fusedStrongTopHit();

    expect(evidence[0].score).toBeLessThan(0.1);
    expect(evidence[0].vectorScore).toBeGreaterThanOrEqual(0.9);
  });

  it("calibratedRelevance reads the cosine signal, not the RRF ordering score", () => {
    const evidence = fusedStrongTopHit();

    expect(calibratedRelevance(evidence[0])).toBeGreaterThanOrEqual(0.9);
  });

  it("prefers rerank relevance over cosine when a reranker scored the chunk", () => {
    expect(
      calibratedRelevance(chunk({ id: "A", score: 0.03, vectorScore: 0.9, rerankScore: 0.42 })),
    ).toBe(0.42);
  });

  it("falls back to the raw score for exact-literal pins without a cosine", () => {
    expect(
      calibratedRelevance(
        chunk({ id: "A", score: 0.62, retrievalSource: "exact", exactPinned: true }),
      ),
    ).toBe(0.62);
  });

  it("treats a top-ranked high-cosine fused hit as strong retrieval", () => {
    const strength = summarizeRetrievalStrength(fusedStrongTopHit());

    expect(strength.weak).toBe(false);
    expect(strength.strong).toBe(true);
  });

  it("does not force insufficient_support for a strong fused hit with grounded claims", () => {
    const evidence = fusedStrongTopHit();
    const level = determineSupportLevel({
      topDocScore: calibratedRelevance(evidence[0]),
      secondDocScore: calibratedRelevance(evidence[1]),
      docEvidenceCount: evidence.length,
      toolEvidenceCount: 0,
      customerClaimCount: 2,
      internalClaimCount: 2,
      blocker: { kind: "none" },
    });

    expect(level).not.toBe("insufficient_support");
  });

  it("still reports genuinely weak retrieval as weak", () => {
    const weakEvidence = [
      chunk({ id: "A", score: 0.02, retrievalSource: "vector", vectorScore: 0.31 }),
    ];

    expect(summarizeRetrievalStrength(weakEvidence).weak).toBe(true);
  });
});
