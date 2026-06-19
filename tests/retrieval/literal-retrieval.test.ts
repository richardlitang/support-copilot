import { extractLikelyLiterals } from "@/lib/literal-retrieval";
import * as literalRetrieval from "@/lib/literal-retrieval";
import { applyRerankScores, mergeRetrievalCandidates } from "@/lib/retrieval-candidates";
import type { EvidenceChunk } from "@/lib/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function chunk(input: Partial<EvidenceChunk> & Pick<EvidenceChunk, "id" | "score">): EvidenceChunk {
  return {
    documentId: "doc-1",
    filename: "docs.md",
    sectionTitle: null,
    content: "content",
    rank: 1,
    chunkIndex: 0,
    ...input,
  };
}

describe("extractLikelyLiterals", () => {
  it("extracts exact support literals without generic tokens", () => {
    expect(
      extractLikelyLiterals(
        "Webhook verification failed with `webhook_signature_failed` for request_id and HTTP retries.",
      ),
    ).toEqual(["webhook_signature_failed", "request_id"]);
  });

  it("extracts snake case, kebab case, and specific uppercase codes", () => {
    expect(
      extractLikelyLiterals("Got livemode_mismatch and checkout-session-expired after KYC_REVIEW."),
    ).toEqual(["livemode_mismatch", "checkout-session-expired", "KYC_REVIEW"]);
  });

  it("extracts short acronyms and meaningful terms from brief natural-language questions", () => {
    expect(extractLikelyLiterals("what is ach payment")).toEqual(["ACH", "payment"]);
  });
});

describe("extractExactCodeLiterals", () => {
  const extractExactCodeLiterals = (literalRetrieval as typeof literalRetrieval & {
    extractExactCodeLiterals: (input: string) => string[];
  }).extractExactCodeLiterals;

  it("extracts code-shaped support terms without treating natural language as exact", () => {
    expect(extractExactCodeLiterals("duplicate_payment_attempt what does it mean")).toEqual([
      "duplicate_payment_attempt",
    ]);
    expect(extractExactCodeLiterals("ERR-4021-X failed")).toEqual(["ERR-4021-X"]);
    expect(extractExactCodeLiterals("what is ach payment")).toEqual([]);
  });
});

describe("direct literal retrieval", () => {
  it("searches section titles as well as content for literal matches", () => {
    const chunksSource = readFileSync(resolve(import.meta.dirname, "../../src/server/db/chunks.ts"), "utf8");

    expect(chunksSource).toContain("document_chunks.content ilike");
    expect(chunksSource).toContain("document_chunks.section_title ilike");
  });
});

describe("mergeRetrievalCandidates", () => {
  it("dedupes vector and literal hits while preserving provenance", () => {
    const merged = mergeRetrievalCandidates([
      chunk({ id: "chunk-1", score: 0.74, retrievalSource: "vector", vectorScore: 0.74 }),
      chunk({
        id: "chunk-1",
        score: 0.7,
        retrievalSource: "literal",
        literalMatches: ["webhook_signature_failed"],
      }),
      chunk({
        id: "chunk-2",
        score: 0.62,
        retrievalSource: "literal",
        literalMatches: ["request_id"],
      }),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "chunk-1",
      retrievalSource: "hybrid",
      vectorScore: 0.74,
      literalMatches: ["webhook_signature_failed"],
      rank: 1,
    });
  });
});

describe("applyRerankScores", () => {
  it("orders candidates by reranker relevance and stores rerank score", () => {
    const reranked = applyRerankScores(
      [chunk({ id: "chunk-1", score: 0.9 }), chunk({ id: "chunk-2", score: 0.5 })],
      [
        { index: 1, score: 0.99 },
        { index: 0, score: 0.12 },
      ],
    );

    expect(reranked.map((item) => item.id)).toEqual(["chunk-2", "chunk-1"]);
    expect(reranked[0]).toMatchObject({ rank: 1, rerankScore: 0.99, score: 0.99 });
  });
});
