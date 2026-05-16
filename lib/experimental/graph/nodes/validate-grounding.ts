import { collectCitationIds } from "@/lib/evidence-builder";
import { markInvestigationGraphStep } from "@/lib/experimental/graph/investigation-state";
import type { InvestigationGraphState } from "@/lib/experimental/graph/investigation-state";

export function validateGroundingNode(state: InvestigationGraphState): InvestigationGraphState {
  if (!state.claimDraft) {
    throw new Error("Cannot validate grounding before claim generation.");
  }

  const allowedCitationIds = new Set([
    ...state.docEvidence.map((item) => item.id),
    ...state.toolArtifacts.toolEvidence.map((item) => item.id),
  ]);
  const citedIds = collectCitationIds({
    customerReply: state.claimDraft.customerReply,
    internalDiagnosis: state.claimDraft.internalDiagnosis,
  });
  const missingCitationIds = citedIds.filter((citation) => !allowedCitationIds.has(citation));
  const validationFailed = missingCitationIds.length > 0;

  return markInvestigationGraphStep(
    {
      ...state,
      grounding: {
        validationFailed,
        validCitationIds: citedIds.filter((citation) => allowedCitationIds.has(citation)),
        missingCitationIds,
      },
    },
    "validated_grounding",
  );
}
