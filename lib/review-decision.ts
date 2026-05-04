import type { SupportLevel } from "@/lib/types";
import type { ReviewDecision, ReviewStatus } from "@/lib/types/investigation";

export function determineReviewDecision(input: {
  reviewStatus: ReviewStatus;
  supportLevel: SupportLevel;
  missingRequiredContext: boolean;
  hasConflict: boolean;
  validationFailed: boolean;
}): ReviewDecision {
  if (input.reviewStatus === "ready") {
    return {
      status: "ready",
      reasonCode: "none",
      action: "none"
    };
  }

  if (input.missingRequiredContext) {
    return {
      status: input.reviewStatus,
      reasonCode: "missing_account_context",
      action: "add_context"
    };
  }

  if (input.hasConflict) {
    return {
      status: input.reviewStatus,
      reasonCode: "unresolved_evidence_conflict",
      action: "inspect_conflict"
    };
  }

  if (input.validationFailed) {
    return {
      status: input.reviewStatus,
      reasonCode: "grounding_validation_failed",
      action: "review_claims"
    };
  }

  if (input.supportLevel === "insufficient_support") {
    return {
      status: input.reviewStatus,
      reasonCode: "weak_retrieval",
      action: "add_docs"
    };
  }

  return {
    status: input.reviewStatus,
    reasonCode: "weak_retrieval",
    action: "review_claims"
  };
}
