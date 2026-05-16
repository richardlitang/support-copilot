import {
  generateClaimsFromEvidence,
  type ClaimGenerationDependencies,
  defaultClaimGenerationDependencies,
} from "@/lib/claim-generation";
import type { InvestigationGraphState } from "@/src/server/investigation/graph/investigation-state";
import { markInvestigationGraphStep } from "@/src/server/investigation/graph/investigation-state";

export type GenerateClaimsDependencies = ClaimGenerationDependencies;

export async function generateClaimsNode(
  state: InvestigationGraphState,
  dependencies: Partial<GenerateClaimsDependencies> = {},
): Promise<InvestigationGraphState> {
  if (!state.routing) {
    throw new Error("Cannot generate claims before classification.");
  }

  const deps = {
    ...defaultClaimGenerationDependencies,
    ...dependencies,
  };
  const claimDraft = await generateClaimsFromEvidence(
    {
      ticket: state.input.ticket,
      mode: state.routing.mode,
      routingReason: state.routing.routingReason,
      evidence: state.retrievedEvidence,
      docEvidence: state.docEvidence,
      toolEvidence: state.toolArtifacts.toolEvidence,
      missingRequiredContext: state.missingRequiredContext,
      hasConflict: state.hasConflict,
      conflictReason: state.conflictReason,
    },
    deps,
  );

  return markInvestigationGraphStep(
    {
      ...state,
      claimDraft,
    },
    "generated_claims",
  );
}
