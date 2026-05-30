import type { SupportLevel } from "@/lib/types";
import type { InvestigationBlocker } from "@/lib/types/investigation";

export function determineSupportLevel(input: {
  topDocScore: number;
  secondDocScore: number;
  docEvidenceCount: number;
  toolEvidenceCount: number;
  customerClaimCount: number;
  internalClaimCount: number;
  blocker: InvestigationBlocker;
}): SupportLevel {
  if (input.blocker.kind !== "none") {
    return "insufficient_support";
  }

  const totalClaims = input.customerClaimCount + input.internalClaimCount;

  if (!input.docEvidenceCount || totalClaims === 0) {
    return "insufficient_support";
  }

  const strongDocs =
    input.topDocScore >= 0.8 && (input.docEvidenceCount === 1 || input.secondDocScore >= 0.64);
  const decentDocs = input.topDocScore >= 0.66;
  const usableDocs = input.topDocScore >= 0.52;
  const marginalMultiSourceDocs =
    input.topDocScore >= 0.46 &&
    input.secondDocScore >= 0.46 &&
    input.docEvidenceCount >= 2 &&
    totalClaims >= 2;

  if (strongDocs && totalClaims >= 2) {
    return "high";
  }

  if (decentDocs && totalClaims >= 2) {
    return input.toolEvidenceCount > 0 ? "medium" : "low";
  }

  if (decentDocs && totalClaims >= 1) {
    return "low";
  }

  if (usableDocs && totalClaims >= 1) {
    return "low";
  }

  if (marginalMultiSourceDocs) {
    return "low";
  }

  return "insufficient_support";
}
