import { describe, expect, it, vi } from "vitest";
type RetrievalBoundaryTrace = {
  rerankerInputCandidateIds: string[];
  finalCandidateIds: string[];
};

const dbMock = vi.hoisted(() => ({
  matchDocumentChunksDb: vi.fn(),
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
    dbMock.matchDocumentChunksDb.mockResolvedValue([
      {
        id: "gold-chunk",
        documentId: "doc-1",
        filename: "support.md",
        sectionTitle: "Payments",
        content: "duplicate_payment_attempt means a second payment attempt already has a successful payment",
        score: 0.8,
        rank: 1,
        chunkIndex: 0,
      },
    ]);
    dbMock.matchLiteralDocumentChunksDb.mockResolvedValue([]);
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
    expect(trace?.finalCandidateIds.length).toBeLessThanOrEqual(8);
  });
});
