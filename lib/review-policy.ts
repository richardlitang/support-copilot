import type { InvestigationMode, ReviewStatus } from "@/lib/types/investigation-v2";
import type { SupportLevel } from "@/lib/types";

export function determineReviewStatus(input: {
  mode: InvestigationMode;
  supportLevel: SupportLevel;
  hasConflict: boolean;
  missingRequiredContext: boolean;
  validationFailed: boolean;
}) : ReviewStatus {
  if (
    input.mode === "needs_human_review" ||
    input.supportLevel === "insufficient_support" ||
    input.hasConflict ||
    input.missingRequiredContext ||
    input.validationFailed
  ) {
    return "needs_human_review";
  }

  return "ready";
}

export function shouldEscalateToHumanReview(input: {
  hasConflict: boolean;
  missingRequiredContext: boolean;
  supportLevel: SupportLevel;
  validationFailed: boolean;
}) {
  return (
    input.hasConflict ||
    input.missingRequiredContext ||
    input.supportLevel === "insufficient_support" ||
    input.validationFailed
  );
}
