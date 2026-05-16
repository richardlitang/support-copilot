import { rerankEvidenceCandidates } from "@/src/server/ai/rerank";
import type { EvidenceChunk } from "@/lib/types";

function candidate(id: string, content: string): EvidenceChunk {
  return {
    id,
    documentId: "doc-1",
    filename: "docs.md",
    sectionTitle: null,
    content,
    score: 0.5,
    rank: 1,
    chunkIndex: 0,
  };
}

describe("rerankEvidenceCandidates", () => {
  const originalApiKey = process.env.COHERE_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.COHERE_API_KEY;
    } else {
      process.env.COHERE_API_KEY = originalApiKey;
    }
  });

  it("skips hosted reranking when no Cohere key is configured", async () => {
    delete process.env.COHERE_API_KEY;
    const scores = await rerankEvidenceCandidates({
      query: "webhook_signature_failed",
      candidates: [candidate("chunk-1", "Webhook troubleshooting")],
      topN: 1,
      fetcher: async () => {
        throw new Error("fetch should not be called without a key");
      },
    });

    expect(scores).toEqual([]);
  });

  it("maps Cohere rerank results into candidate indexes and scores", async () => {
    process.env.COHERE_API_KEY = "test-key";
    const scores = await rerankEvidenceCandidates({
      query: "webhook_signature_failed",
      candidates: [
        candidate("chunk-1", "Generic webhook docs"),
        candidate("chunk-2", "webhook_signature_failed means the signature could not be verified"),
      ],
      topN: 2,
      fetcher: async (_url, init) => {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          query: "webhook_signature_failed",
          top_n: 2,
        });

        return new Response(
          JSON.stringify({
            results: [
              { index: 1, relevance_score: 0.98 },
              { index: 0, relevance_score: 0.24 },
            ],
          }),
          { status: 200 },
        );
      },
    });

    expect(scores).toEqual([
      { index: 1, score: 0.98 },
      { index: 0, score: 0.24 },
    ]);
  });
});
