import { buildDocsGapReport } from "@/lib/docs-gap-report";
import type { DocEvidenceItem, ReviewDecision } from "@/lib/types/investigation";

const weakRetrievalDecision: ReviewDecision = {
  status: "needs_human_review",
  reasonCode: "weak_retrieval",
  action: "add_docs",
};

const docEvidence: DocEvidenceItem[] = [
  {
    id: "S1",
    sourceType: "doc",
    documentId: "doc-1",
    filename: "webhooks.md",
    sectionTitle: "Signature failures",
    excerpt: "Rotate webhook secrets before validating new signatures.",
    score: 0.51,
    chunkIndex: 0,
    retrievalSource: "literal",
    literalMatches: ["webhook_signature_failed"],
  },
];

describe("buildDocsGapReport", () => {
  it("builds a structured report for weak documentation support", () => {
    expect(
      buildDocsGapReport({
        ticket: "Webhook verification failed with webhook_signature_failed.",
        reviewDecision: weakRetrievalDecision,
        routingReason: "Documentation evidence was too weak to support a grounded answer.",
        internalDiagnosis: {
          claims: [],
          openQuestions: ["Add a troubleshooting entry for webhook_signature_failed."],
        },
        docEvidence,
        toolEvidence: [],
      }),
    ).toMatchObject({
      gapType: "unsupported_by_docs",
      whatTicketNeeded: "Webhook verification failed with webhook_signature_failed.",
      suggestedNextAction:
        "Add or update documentation that directly answers this ticket, then rerun the investigation.",
      missingInformation: ["Add a troubleshooting entry for webhook_signature_failed."],
      evidenceSnapshot: [
        {
          id: "S1",
          sourceType: "doc",
          title: "webhooks.md - Signature failures",
          score: 0.51,
        },
      ],
    });
  });

  it("does not build a report for ready investigations", () => {
    expect(
      buildDocsGapReport({
        ticket: "How do I rotate webhook secrets?",
        reviewDecision: {
          status: "ready",
          reasonCode: "none",
          action: "none",
        },
        routingReason: "Strong retrieval.",
        internalDiagnosis: {
          claims: [],
          openQuestions: [],
        },
        docEvidence,
        toolEvidence: [],
      }),
    ).toBeUndefined();
  });
});
