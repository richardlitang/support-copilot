import type { AnswerQualityCheck, DocsGapReport, ReviewDecision } from "@/lib/types/investigation";

function toReadinessReason(input: {
  reviewDecision: ReviewDecision;
  routingReason: string;
}): string {
  if (input.reviewDecision.status === "ready") {
    return "Grounded claims satisfied the current review policy.";
  }

  switch (input.reviewDecision.reasonCode) {
    case "missing_account_context":
      return "Required account or product context is missing.";
    case "weak_retrieval":
      return "Retrieved evidence was not strong enough for a supported answer.";
    case "unresolved_evidence_conflict":
      return "Documentation and context evidence do not explain the issue.";
    case "grounding_validation_failed":
      return "Claim grounding validation rejected part of the drafted answer.";
    default:
      return input.routingReason;
  }
}

export function buildAnswerQualityCheck(input: {
  reviewDecision: ReviewDecision;
  routingReason: string;
  docEvidenceCount: number;
  toolEvidenceCount: number;
  totalClaims: number;
  invalidCitations: number;
  docsGapReport?: DocsGapReport;
}): AnswerQualityCheck {
  const hasBlockingReview = input.reviewDecision.status === "needs_human_review";
  const hasGroundingFailure = input.reviewDecision.reasonCode === "grounding_validation_failed";
  const hasWeakEvidence =
    input.reviewDecision.reasonCode === "weak_retrieval" ||
    input.reviewDecision.reasonCode === "unresolved_evidence_conflict";
  const unsupportedClaims = hasGroundingFailure ? Math.max(1, input.invalidCitations) : 0;
  const weakClaims = hasWeakEvidence ? input.totalClaims : 0;
  const supportedClaims = Math.max(
    0,
    input.totalClaims - input.invalidCitations - weakClaims - unsupportedClaims,
  );

  return {
    retrieval: {
      sourceCount: input.docEvidenceCount + input.toolEvidenceCount,
      topK: 5,
      ignoredDocStatuses: ["uploaded", "processing", "failed"],
    },
    grounding: {
      totalClaims: input.totalClaims,
      supportedClaims,
      weakClaims,
      unsupportedClaims,
      invalidCitations: input.invalidCitations,
    },
    readiness: {
      status: hasBlockingReview
        ? input.reviewDecision.action === "none"
          ? "blocked"
          : "needs_human_review"
        : "ready",
      reasons: [toReadinessReason(input)],
    },
    missingInfo: {
      hasDocsGap: Boolean(input.docsGapReport),
      missingItems: input.docsGapReport?.missingInformation ?? [],
    },
  };
}
