import { getReviewAction } from "@/lib/review-actions";
import type { InvestigationResult } from "@/lib/types/investigation";

const baseResult: InvestigationResult = {
  investigationId: "investigation-1",
  ticketId: "ticket-1",
  executionMode: "draft_answer",
  mode: "needs_human_review",
  supportLevel: "insufficient_support",
  reviewStatus: "needs_human_review",
  reviewDecision: {
    status: "needs_human_review",
    reasonCode: "weak_retrieval",
    action: "add_docs",
  },
  routingReason: "Documentation evidence was too weak to support a grounded answer.",
  customerReply: {
    claims: [],
  },
  internalDiagnosis: {
    claims: [],
    openQuestions: ["Add stronger documentation or rerun with investigation context."],
  },
  docEvidence: [],
  toolEvidence: [],
  toolCalls: [],
  pipelineTrace: [],
  qualityCheck: {
    retrieval: {
      sourceCount: 0,
      topK: 5,
      ignoredDocStatuses: ["uploaded", "processing", "failed"],
    },
    grounding: {
      totalClaims: 0,
      supportedClaims: 0,
      weakClaims: 0,
      unsupportedClaims: 0,
      invalidCitations: 0,
    },
    readiness: {
      status: "needs_human_review",
      reasons: ["Retrieved evidence was not strong enough for a supported answer."],
    },
    missingInfo: {
      hasDocsGap: false,
      missingItems: [],
    },
  },
};

describe("getReviewAction", () => {
  it("returns no action for ready investigations", () => {
    expect(
      getReviewAction({
        ...baseResult,
        mode: "docs_only",
        supportLevel: "medium",
        reviewStatus: "ready",
        reviewDecision: {
          status: "ready",
          reasonCode: "none",
          action: "none",
        },
      }),
    ).toBeNull();
  });

  it("asks for account context when context is missing", () => {
    expect(
      getReviewAction({
        ...baseResult,
        reviewDecision: {
          status: "needs_human_review",
          reasonCode: "missing_account_context",
          action: "add_context",
        },
        routingReason:
          "Structured product or account context is required for this ticket, but none was provided.",
        internalDiagnosis: {
          claims: [],
          openQuestions: [
            "Add investigation context or select a debug account and rerun the investigation.",
          ],
        },
      }),
    ).toMatchObject({
      kind: "add_context",
      primaryActionLabel: "Add context and retry",
    });
  });

  it("asks for stronger docs when retrieval cannot support the answer", () => {
    expect(getReviewAction(baseResult)).toMatchObject({
      kind: "add_docs",
      primaryActionLabel: "Add docs and retry",
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
            chunkIndex: 0,
          },
        ],
        reviewDecision: {
          status: "needs_human_review",
          reasonCode: "unresolved_evidence_conflict",
          action: "inspect_conflict",
        },
        routingReason: "Docs and current tool state do not explain the reported issue.",
        internalDiagnosis: {
          claims: [],
          openQuestions: ["The docs and current tool state do not explain the issue."],
        },
      }),
    ).toMatchObject({
      kind: "inspect_conflict",
      title: "Resolve the evidence gap",
    });
  });
});
