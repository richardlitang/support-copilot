import {
  buildStructuredHumanReviewFallback,
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswer as generateInvestigationAnswerAdapter,
} from "@/src/server/ai/answer";
import type { EvidenceChunk } from "@/lib/types";
import type {
  CitationId,
  DocEvidenceItem,
  InvestigationBlocker,
  InvestigationMode,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolEvidenceItem,
} from "@/lib/types/investigation";

export type ClaimGenerationResult = {
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  insufficientSupport: boolean;
  validationFailed?: boolean;
};

export type ClaimGenerationDependencies = {
  generateGroundedAnswer: typeof generateGroundedAnswerAdapter;
  generateInvestigationAnswer: typeof generateInvestigationAnswerAdapter;
};

export const defaultClaimGenerationDependencies: ClaimGenerationDependencies = {
  generateGroundedAnswer: generateGroundedAnswerAdapter,
  generateInvestigationAnswer: generateInvestigationAnswerAdapter,
};

function firstAvailableCitation(input: {
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
}) {
  return (input.docEvidence[0]?.id ?? input.toolEvidence[0]?.id) as CitationId | undefined;
}

export async function generateClaimsFromEvidence(
  input: {
    ticket: string;
    mode: InvestigationMode;
    routingReason: string;
    evidence: EvidenceChunk[];
    docEvidence: DocEvidenceItem[];
    toolEvidence: ToolEvidenceItem[];
    blocker: InvestigationBlocker;
  },
  dependencies: Partial<ClaimGenerationDependencies> = {},
): Promise<ClaimGenerationResult> {
  const deps = {
    ...defaultClaimGenerationDependencies,
    ...dependencies,
  };
  const firstCitation = firstAvailableCitation(input);

  if (input.blocker.kind !== "none") {
    return buildStructuredHumanReviewFallback({
      customerMessage: firstCitation
        ? "I cannot confirm the cause without the required investigation context."
        : undefined,
      internalMessage:
        input.blocker.kind === "conflict"
          ? input.blocker.reason
          : "Structured product or account context required but not provided for this investigation.",
      citations: firstCitation ? [firstCitation] : [],
      openQuestions:
        input.blocker.kind === "missing_context"
          ? ["Add investigation context or select a debug account and rerun the investigation."]
          : ["The docs and current tool state do not explain the issue."],
    });
  }

  if (input.mode === "docs_only") {
    if (!input.evidence.length) {
      return buildStructuredHumanReviewFallback({
        internalMessage: "Documentation evidence was too weak to support a grounded answer.",
        openQuestions: [
          "Add stronger documentation or rerun with investigation context if the issue is account-specific.",
        ],
      });
    }

    const grounded = await deps.generateGroundedAnswer({
      ticket: input.ticket,
      evidence: input.evidence,
    });
    const claims = grounded.claims.map((claim) => ({
      text: claim.text,
      citations: claim.citationIds as CitationId[],
    }));

    return !claims.length && grounded.insufficientSupport
      ? buildStructuredHumanReviewFallback({
          customerMessage: firstCitation
            ? "I do not have enough support in the uploaded docs to answer this confidently."
            : undefined,
          internalMessage: "Documentation evidence was too weak to support a grounded answer.",
          citations: firstCitation ? [firstCitation] : [],
          openQuestions: [
            "Add stronger documentation or rerun with investigation context if the issue is account-specific.",
          ],
        })
      : {
          customerReply: {
            summary: claims[0]?.text,
            claims,
          },
          internalDiagnosis: {
            summary: claims[0]?.text,
            claims,
            openQuestions: grounded.insufficientSupport
              ? ["Documentation support was limited."]
              : [],
          },
          insufficientSupport: grounded.insufficientSupport,
        };
  }

  return deps.generateInvestigationAnswer({
    ticket: input.ticket,
    mode: input.mode,
    routingReason: input.routingReason,
    docEvidence: input.docEvidence,
    toolEvidence: input.toolEvidence,
  });
}
