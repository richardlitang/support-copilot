import {
  buildStructuredHumanReviewFallback,
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswerV2 as generateInvestigationAnswerV2Adapter
} from "@/lib/answer";
import type { CitationId } from "@/lib/types/investigation-v2";
import type { ClaimDraftState, InvestigationGraphState } from "@/lib/graph/investigation-state";
import { markInvestigationGraphStep } from "@/lib/graph/investigation-state";

export type GenerateClaimsDependencies = {
  generateGroundedAnswer: typeof generateGroundedAnswerAdapter;
  generateInvestigationAnswerV2: typeof generateInvestigationAnswerV2Adapter;
};

const defaultDependencies: GenerateClaimsDependencies = {
  generateGroundedAnswer: generateGroundedAnswerAdapter,
  generateInvestigationAnswerV2: generateInvestigationAnswerV2Adapter
};

function firstAvailableCitation(state: InvestigationGraphState) {
  return (state.docEvidence[0]?.id ?? state.toolArtifacts.toolEvidence[0]?.id) as CitationId | undefined;
}

export async function generateClaimsNode(
  state: InvestigationGraphState,
  dependencies: Partial<GenerateClaimsDependencies> = {}
): Promise<InvestigationGraphState> {
  if (!state.routing) {
    throw new Error("Cannot generate claims before classification.");
  }

  const deps = {
    ...defaultDependencies,
    ...dependencies
  };
  const firstCitation = firstAvailableCitation(state);
  let claimDraft: ClaimDraftState;

  if (state.missingRequiredContext || state.hasConflict) {
    const fallback = buildStructuredHumanReviewFallback({
      customerMessage: firstCitation ? "I cannot confirm the cause without the required investigation context." : undefined,
      internalMessage: state.conflictReason ?? "Structured product or account context required but not provided for this investigation.",
      citations: firstCitation ? [firstCitation] : [],
      openQuestions: state.missingRequiredContext
        ? ["Add investigation context or select a debug account and rerun the investigation."]
        : ["The docs and current tool state do not explain the issue."]
    });
    claimDraft = fallback;
  } else if (state.routing.mode === "docs_only") {
    if (!state.retrievedEvidence.length) {
      claimDraft = buildStructuredHumanReviewFallback({
        internalMessage: "Documentation evidence was too weak to support a grounded answer.",
        openQuestions: ["Add stronger documentation or rerun with investigation context if the issue is account-specific."]
      });
    } else {
      const legacy = await deps.generateGroundedAnswer({
        ticket: state.input.ticket,
        evidence: state.retrievedEvidence
      });
      const legacyClaims = legacy.claims.map((claim) => ({
        text: claim.text,
        citations: claim.citationIds as CitationId[]
      }));

      claimDraft =
        !legacyClaims.length && legacy.insufficientSupport
          ? buildStructuredHumanReviewFallback({
              customerMessage: firstCitation
                ? "I do not have enough support in the uploaded docs to answer this confidently."
                : undefined,
              internalMessage: "Documentation evidence was too weak to support a grounded answer.",
              citations: firstCitation ? [firstCitation] : [],
              openQuestions: ["Add stronger documentation or rerun with investigation context if the issue is account-specific."]
            })
          : {
              customerReply: {
                summary: legacyClaims[0]?.text,
                claims: legacyClaims
              },
              internalDiagnosis: {
                summary: legacyClaims[0]?.text,
                claims: legacyClaims,
                openQuestions: legacy.insufficientSupport ? ["Documentation support was limited."] : []
              },
              insufficientSupport: legacy.insufficientSupport
            };
    }
  } else {
    claimDraft = await deps.generateInvestigationAnswerV2({
      ticket: state.input.ticket,
      mode: state.routing.mode,
      routingReason: state.routing.routingReason,
      docEvidence: state.docEvidence,
      toolEvidence: state.toolArtifacts.toolEvidence
    });
  }

  return markInvestigationGraphStep(
    {
      ...state,
      claimDraft
    },
    "generated_claims"
  );
}
