import type { SupportLevel } from "@/lib/types";
import type {
  InvestigationBlocker,
  ReviewDecision,
  ReviewStatus,
} from "@/lib/types/investigation";

export function determineReviewDecision(input: {
  reviewStatus: ReviewStatus;
  supportLevel: SupportLevel;
  blocker: InvestigationBlocker;
}): ReviewDecision {
  if (input.reviewStatus === "ready") {
    return {
      status: "ready",
      reasonCode: "none",
      action: "none",
    };
  }

  switch (input.blocker.kind) {
    case "missing_context":
      return {
        status: input.reviewStatus,
        reasonCode: "missing_account_context",
        action: "add_context",
      };
    case "conflict":
      return {
        status: input.reviewStatus,
        reasonCode: "unresolved_evidence_conflict",
        action: "inspect_conflict",
      };
    case "validation_failed":
      return {
        status: input.reviewStatus,
        reasonCode: "grounding_validation_failed",
        action: "review_claims",
      };
    default:
      break;
  }

  if (input.supportLevel === "insufficient_support") {
    return {
      status: input.reviewStatus,
      reasonCode: "weak_retrieval",
      action: "add_docs",
    };
  }

  return {
    status: input.reviewStatus,
    reasonCode: "weak_retrieval",
    action: "review_claims",
  };
}
