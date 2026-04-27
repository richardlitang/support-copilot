import { getReviewAction } from "@/lib/review-actions";
import type { InvestigationResultV2 } from "@/lib/types/investigation-v2";

const baseResult: InvestigationResultV2 = {
  investigationId: "investigation-1",
  ticketId: "ticket-1",
  mode: "needs_human_review",
  supportLevel: "insufficient_support",
  reviewStatus: "needs_human_review",
  routingReason: "Documentation evidence was too weak to support a grounded answer.",
  customerReply: {
    claims: []
  },
  internalDiagnosis: {
    claims: [],
    openQuestions: ["Add stronger documentation or rerun with investigation context."]
  },
  docEvidence: [],
  toolEvidence: [],
  toolCalls: [],
  answer: "",
  claims: [],
  citations: [],
  evidence: [],
  insufficientSupport: true
};

describe("getReviewAction", () => {
  it("returns no action for ready investigations", () => {
    expect(
      getReviewAction({
        ...baseResult,
        mode: "docs_only",
        supportLevel: "medium",
        reviewStatus: "ready",
        insufficientSupport: false
      })
    ).toBeNull();
  });

  it("asks for account context when context is missing", () => {
    expect(
      getReviewAction({
        ...baseResult,
        routingReason: "Structured product or account context is required for this ticket, but none was provided.",
        internalDiagnosis: {
          claims: [],
          openQuestions: ["Add investigation context or select a debug account and rerun the investigation."]
        }
      })
    ).toMatchObject({
      kind: "add_context",
      primaryActionLabel: "Add context and retry"
    });
  });

  it("asks for stronger docs when retrieval cannot support the answer", () => {
    expect(getReviewAction(baseResult)).toMatchObject({
      kind: "add_docs",
      primaryActionLabel: "Add docs and retry"
    });
  });

  it("asks reviewers to resolve conflicts when docs and tools do not explain the issue", () => {
    expect(
      getReviewAction({
        ...baseResult,
        docEvidence: [
          {
            id: "S1",
            sourceType: "doc",
            documentId: "doc-1",
            filename: "exports.md",
            excerpt: "Exports are enabled on Enterprise.",
            score: 0.78,
            chunkIndex: 0
          }
        ],
        routingReason: "Docs and current tool state do not explain the reported issue.",
        internalDiagnosis: {
          claims: [],
          openQuestions: ["The docs and current tool state do not explain the issue."]
        }
      })
    ).toMatchObject({
      kind: "inspect_conflict",
      title: "Resolve the evidence gap"
    });
  });
});
