import { describe, expect, it, vi } from "vitest";
type RetrievalBoundaryTrace = {
  pinnedCandidateIds: string[];
  rerankerInputCandidateIds: string[];
  finalCandidateIds: string[];
};

const dbMock = vi.hoisted(() => ({
  matchDocumentChunksDb: vi.fn(),
  matchFtsDocumentChunksDb: vi.fn(),
  matchLiteralDocumentChunksDb: vi.fn(),
}));
const embedMock = vi.hoisted(() => ({ embedText: vi.fn() }));
const rerankMock = vi.hoisted(() => ({ rerankEvidenceCandidates: vi.fn() }));

vi.mock("@/src/server/db/retrieval", () => dbMock);
vi.mock("@/src/server/ai/embed", () => embedMock);
vi.mock("@/src/server/ai/rerank", () => rerankMock);
vi.mock("@/src/server/observability/sentry", () => ({ captureServerException: vi.fn() }));

import { retrieveEvidence } from "@/src/server/retrieval/retrieve";

describe("retrieveEvidence trace", () => {
  it("reports reranker input and final evidence boundaries", async () => {
    embedMock.embedText.mockResolvedValue([0.1, 0.2]);
    dbMock.matchDocumentChunksDb.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => ({
        id: index === 0 ? "gold-chunk" : `vector-${index}`,
        documentId: "doc-1",
        filename: "support.md",
        sectionTitle: "Payments",
        content: "duplicate_payment_attempt means a second payment attempt already has a successful payment",
        score: 0.8 - index / 100,
        rank: index + 1,
        chunkIndex: index,
      })),
    );
    dbMock.matchLiteralDocumentChunksDb.mockResolvedValue([
      {
        id: "exact-1",
        documentId: "doc-1",
        filename: "support.md",
        sectionTitle: "Payments",
        content: "duplicate_payment_attempt means a second payment attempt already has a successful payment",
        score: 0.62,
        rank: 1,
        chunkIndex: 0,
        retrievalSource: "exact",
      },
    ]);
    dbMock.matchFtsDocumentChunksDb.mockResolvedValue([]);
    rerankMock.rerankEvidenceCandidates.mockResolvedValue([{ index: 0, score: 0.95 }]);
    let trace: RetrievalBoundaryTrace | undefined;

    await retrieveEvidence(
      {
        question: "duplicate_payment_attempt",
        sessionId: "session-1",
        onTrace: (nextTrace: RetrievalBoundaryTrace) => {
          trace = nextTrace;
        },
      } as Parameters<typeof retrieveEvidence>[0],
    );

    expect(trace?.rerankerInputCandidateIds).toContain("gold-chunk");
    expect(trace?.pinnedCandidateIds).toContain("exact-1");
    expect(trace?.rerankerInputCandidateIds).toHaveLength(50);
    expect(trace?.finalCandidateIds.length).toBeLessThanOrEqual(8);
    expect(dbMock.matchFtsDocumentChunksDb).toHaveBeenCalledOnce();
  });
});
