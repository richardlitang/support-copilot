import { generateClaimsFromEvidence } from "@/lib/claim-generation";
import type { EvidenceChunk } from "@/lib/types";
import type { DocEvidenceItem } from "@/lib/types/investigation";

const evidence: EvidenceChunk[] = [
  {
    id: "chunk-1",
    documentId: "doc-1",
    filename: "exports.md",
    sectionTitle: "Exports",
    content: "Exports require billing setup.",
    score: 0.84,
    rank: 1,
    chunkIndex: 0,
  },
];

const docEvidence: DocEvidenceItem[] = [
  {
    id: "S1",
    sourceType: "doc",
    documentId: "doc-1",
    filename: "exports.md",
    sectionTitle: "Exports",
    excerpt: "Exports require billing setup.",
    score: 0.84,
    chunkIndex: 0,
  },
];

describe("generateClaimsFromEvidence", () => {
  it("converts docs-only grounded answers into the structured claim contract", async () => {
    const result = await generateClaimsFromEvidence(
      {
        ticket: "Why do exports fail?",
        mode: "docs_only",
        routingReason: "Documentation evidence is sufficient.",
        evidence,
        docEvidence,
        toolEvidence: [],
        missingRequiredContext: false,
        hasConflict: false,
        conflictReason: null,
      },
      {
        generateGroundedAnswer: async () => ({
          answer: "Check billing setup. [S1]",
          claims: [{ text: "Check billing setup.", citationIds: ["S1"] }],
          supportLevel: "high",
          citations: ["S1"],
          insufficientSupport: false,
        }),
        generateInvestigationAnswer: async () => {
          throw new Error("Structured investigation generator should not run for docs-only mode.");
        },
      },
    );

    expect(result).toEqual({
      customerReply: {
        summary: "Check billing setup.",
        claims: [{ text: "Check billing setup.", citations: ["S1"] }],
      },
      internalDiagnosis: {
        summary: "Check billing setup.",
        claims: [{ text: "Check billing setup.", citations: ["S1"] }],
        openQuestions: [],
      },
      insufficientSupport: false,
    });
  });

  it("returns a structured fallback without calling a model when context is missing", async () => {
    const result = await generateClaimsFromEvidence(
      {
        ticket: "Why can't this account export?",
        mode: "needs_human_review",
        routingReason: "Account context required.",
        evidence,
        docEvidence,
        toolEvidence: [],
        missingRequiredContext: true,
        hasConflict: false,
        conflictReason: null,
      },
      {
        generateGroundedAnswer: async () => {
          throw new Error("Grounded generator should not run when context is missing.");
        },
        generateInvestigationAnswer: async () => {
          throw new Error("Structured generator should not run when context is missing.");
        },
      },
    );

    expect(result.insufficientSupport).toBe(true);
    expect(result.customerReply.claims[0]?.citations).toEqual(["S1"]);
    expect(result.internalDiagnosis.openQuestions).toEqual([
      "Add investigation context or select a debug account and rerun the investigation.",
    ]);
  });
});
