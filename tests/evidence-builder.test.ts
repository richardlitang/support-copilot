import {
  buildAnswerMarkdownFromClaims,
  collectCitationIds,
  createDocEvidence,
  toGroundedClaims,
} from "@/lib/evidence-builder";
import type { EvidenceChunk } from "@/lib/types";

describe("evidence-builder", () => {
  it("maps retrieved chunks to canonical S citations", () => {
    const evidence: EvidenceChunk[] = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        filename: "exports.md",
        sectionTitle: "Permissions",
        content: "Exports require billing setup and export permission.",
        score: 0.82,
        rank: 1,
        chunkIndex: 0,
      },
    ];

    expect(createDocEvidence(evidence)).toEqual([
      {
        id: "S1",
        sourceType: "doc",
        documentId: "doc-1",
        filename: "exports.md",
        sectionTitle: "Permissions",
        excerpt: "Exports require billing setup and export permission.",
        score: 0.82,
        chunkIndex: 0,
      },
    ]);
  });

  it("derives markdown and grounded claim shapes from structured claims", () => {
    const claims = [
      { text: "Exports require setup.", citations: ["S1" as const] },
      { text: "The account has export context.", citations: ["S1" as const, "T1" as const] },
    ];

    expect(buildAnswerMarkdownFromClaims(claims)).toBe(
      "Exports require setup. [S1]\n\nThe account has export context. [S1][T1]",
    );
    expect(toGroundedClaims(claims)).toEqual([
      { text: "Exports require setup.", citationIds: ["S1"] },
      { text: "The account has export context.", citationIds: ["S1", "T1"] },
    ]);
  });

  it("deduplicates citations across customer and internal claims", () => {
    expect(
      collectCitationIds({
        customerReply: {
          claims: [{ text: "Customer claim.", citations: ["S1"] }],
        },
        internalDiagnosis: {
          claims: [
            { text: "Internal claim.", citations: ["S1", "T1"] },
            { text: "Another internal claim.", citations: ["T1"] },
          ],
        },
      }),
    ).toEqual(["S1", "T1"]);
  });
});
