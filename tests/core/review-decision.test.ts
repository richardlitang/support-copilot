import { determineReviewDecision } from "@/lib/review-decision";

describe("determineReviewDecision", () => {
  it("returns ready with no action when review status is ready", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "ready",
        supportLevel: "high",
        blocker: { kind: "none" },
      }),
    ).toEqual({ status: "ready", reasonCode: "none", action: "none" });
  });

  it("returns add_context action when blocker is missing_context", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "needs_human_review",
        supportLevel: "insufficient_support",
        blocker: { kind: "missing_context" },
      }),
    ).toEqual({
      status: "needs_human_review",
      reasonCode: "missing_account_context",
      action: "add_context",
    });
  });

  it("returns inspect_conflict action when blocker is conflict", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "needs_human_review",
        supportLevel: "medium",
        blocker: { kind: "conflict", reason: "Docs and tool state disagree." },
      }),
    ).toEqual({
      status: "needs_human_review",
      reasonCode: "unresolved_evidence_conflict",
      action: "inspect_conflict",
    });
  });

  it("returns review_claims action when blocker is validation_failed", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "needs_human_review",
        supportLevel: "low",
        blocker: { kind: "validation_failed" },
      }),
    ).toEqual({
      status: "needs_human_review",
      reasonCode: "grounding_validation_failed",
      action: "review_claims",
    });
  });

  it("returns add_docs action when no blocker and support is insufficient", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "needs_human_review",
        supportLevel: "insufficient_support",
        blocker: { kind: "none" },
      }),
    ).toEqual({
      status: "needs_human_review",
      reasonCode: "weak_retrieval",
      action: "add_docs",
    });
  });

  it("returns review_claims when support exists but review is still required", () => {
    expect(
      determineReviewDecision({
        reviewStatus: "needs_human_review",
        supportLevel: "low",
        blocker: { kind: "none" },
      }),
    ).toEqual({
      status: "needs_human_review",
      reasonCode: "weak_retrieval",
      action: "review_claims",
    });
  });
});
