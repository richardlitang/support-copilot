import type {
  InvestigationMode,
  InvestigationBlocker,
  ReviewStatus,
} from "@/lib/types/investigation";
import type { SupportLevel } from "@/lib/types";

export function determineReviewStatus(input: {
  mode: InvestigationMode;
  supportLevel: SupportLevel;
  blocker: InvestigationBlocker;
}): ReviewStatus {
  if (
    input.mode === "needs_human_review" ||
    input.supportLevel === "insufficient_support" ||
    input.blocker.kind !== "none"
  ) {
    return "needs_human_review";
  }

  return "ready";
}

export function shouldEscalateToHumanReview(input: {
  blocker: InvestigationBlocker;
  supportLevel: SupportLevel;
}) {
  return input.blocker.kind !== "none" || input.supportLevel === "insufficient_support";
}
