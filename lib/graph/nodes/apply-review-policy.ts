import { markInvestigationGraphStep } from "@/lib/graph/investigation-state";
import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { determineSupportLevel } from "@/lib/support-level";
import type { InvestigationMode } from "@/lib/types/investigation";
import type { InvestigationGraphState } from "@/lib/graph/investigation-state";

export function applyReviewPolicyNode(state: InvestigationGraphState): InvestigationGraphState {
  if (!state.routing) {
    throw new Error("Cannot apply review policy before classification.");
  }

  if (!state.claimDraft) {
    throw new Error("Cannot apply review policy before claim generation.");
  }

  const validationFailed = state.grounding?.validationFailed ?? false;
  const supportLevel = determineSupportLevel({
    topDocScore: state.docEvidence[0]?.score ?? 0,
    secondDocScore: state.docEvidence[1]?.score ?? 0,
    docEvidenceCount: state.docEvidence.length,
    toolEvidenceCount: state.toolArtifacts.toolEvidence.length,
    customerClaimCount: state.claimDraft.customerReply.claims.length,
    internalClaimCount: state.claimDraft.internalDiagnosis.claims.length,
    hasConflict: state.hasConflict,
    missingRequiredContext: state.missingRequiredContext,
    validationFailed
  });
  const reviewStatus = determineReviewStatus({
    mode: state.routing.mode,
    supportLevel,
    hasConflict: state.hasConflict,
    missingRequiredContext: state.missingRequiredContext,
    validationFailed
  });
  const finalMode: InvestigationMode =
    reviewStatus === "needs_human_review" ||
    shouldEscalateToHumanReview({
      hasConflict: state.hasConflict,
      missingRequiredContext: state.missingRequiredContext,
      supportLevel,
      validationFailed
    })
      ? "needs_human_review"
      : state.routing.mode;

  return markInvestigationGraphStep(
    {
      ...state,
      review: {
        supportLevel,
        reviewStatus,
        finalMode,
        routingReason: state.conflictReason ?? state.routing.routingReason
      }
    },
    "applied_review_policy"
  );
}
