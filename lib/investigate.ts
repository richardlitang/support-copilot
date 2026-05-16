import { detectConflict } from "@/lib/conflict-policy";
import { buildDocsGapReport } from "@/lib/docs-gap-report";
import { persistInvestigationRun as persistInvestigationRunAdapter } from "@/src/server/db";
import {
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswer as generateInvestigationAnswerAdapter,
} from "@/lib/answer";
import { retrieveEvidence as retrieveEvidenceAdapter } from "@/lib/retrieve";
import { getAccountContext as getAccountContextAdapter } from "@/lib/tools/account-context";
import { getFeatureFlags as getFeatureFlagsAdapter } from "@/lib/tools/feature-flags";
import { getRecentErrors as getRecentErrorsAdapter } from "@/lib/tools/recent-errors";
import type { InvestigationExecutionMode, InvestigationResult } from "@/lib/types/investigation";
import {
  buildEvidenceOnlyInvestigation,
  collectContextEvidence,
  decideInvestigationReview,
  generateClaimsForInvestigation,
  persistInvestigation,
  retrieveAndRouteInvestigation,
  type InvestigationDependencies,
  type InvestigationInput,
} from "@/lib/investigation/stages";
import { buildAnswerQualityCheck } from "@/lib/investigation/quality-check";
import { buildPipelineTrace } from "@/lib/investigation/trace";

const defaultDependencies: InvestigationDependencies = {
  persistInvestigationRun: persistInvestigationRunAdapter,
  retrieveEvidence: retrieveEvidenceAdapter,
  generateGroundedAnswer: generateGroundedAnswerAdapter,
  generateInvestigationAnswer: generateInvestigationAnswerAdapter,
  getAccountContext: getAccountContextAdapter,
  getFeatureFlags: getFeatureFlagsAdapter,
  getRecentErrors: getRecentErrorsAdapter,
};

export async function investigateTicket(
  input: InvestigationInput,
  dependencies: Partial<InvestigationDependencies> = {},
) {
  const deps = {
    ...defaultDependencies,
    ...dependencies,
  };

  const retrieval = await retrieveAndRouteInvestigation(input, deps);
  const toolArtifacts = await collectContextEvidence({
    input,
    dependencies: deps,
    routing: retrieval.routing,
    missingRequiredContext: retrieval.missingRequiredContext,
  });

  const conflict = detectConflict({
    mode: retrieval.routing.mode,
    ticket: input.ticket,
    docEvidence: retrieval.docEvidence,
    account: toolArtifacts.account,
    flags: toolArtifacts.flags,
    errors: toolArtifacts.errors,
    missingRequiredContext: retrieval.missingRequiredContext,
  });

  const executionMode: InvestigationExecutionMode = input.executionMode ?? "draft_answer";
  const generated =
    executionMode === "evidence_only"
      ? buildEvidenceOnlyInvestigation({
          missingRequiredContext: retrieval.missingRequiredContext,
          hasConflict: conflict.hasConflict,
          conflictReason: conflict.reason,
        })
      : await generateClaimsForInvestigation({
          input,
          dependencies: deps,
          evidence: retrieval.evidence,
          docEvidence: retrieval.docEvidence,
          routing: retrieval.routing,
          toolArtifacts,
          missingRequiredContext: retrieval.missingRequiredContext,
          hasConflict: conflict.hasConflict,
          conflictReason: conflict.reason,
        });

  const review = decideInvestigationReview({
    routing: retrieval.routing,
    generated,
    docEvidence: retrieval.docEvidence,
    toolArtifacts,
    missingRequiredContext: retrieval.missingRequiredContext,
    hasConflict: conflict.hasConflict,
  });
  const routingReason = conflict.reason ?? retrieval.routing.routingReason;
  const persisted = await persistInvestigation({
    input,
    dependencies: deps,
    generated,
    evidence: retrieval.evidence,
    toolArtifacts,
    mode: review.finalMode,
    reviewStatus: review.reviewStatus,
    reviewDecision: review.reviewDecision,
    supportLevel: review.supportLevel,
    routingReason,
  });
  const pipelineTrace = buildPipelineTrace({
    input,
    executionMode,
    evidence: retrieval.evidence,
    docEvidence: retrieval.docEvidence,
    routing: retrieval.routing,
    toolArtifacts,
    hasConflict: conflict.hasConflict,
    conflictReason: conflict.reason,
    generated,
    review,
    persisted,
  });
  const docsGapReport = buildDocsGapReport({
    ticket: input.ticket,
    reviewDecision: review.reviewDecision,
    routingReason,
    internalDiagnosis: generated.internalDiagnosis,
    docEvidence: retrieval.docEvidence,
    toolEvidence: toolArtifacts.toolEvidence,
  });
  const totalClaims =
    generated.customerReply.claims.length + generated.internalDiagnosis.claims.length;
  const invalidCitations = [
    ...generated.customerReply.claims,
    ...generated.internalDiagnosis.claims,
  ].filter((claim) => claim.citations.length === 0).length;
  const qualityCheck = buildAnswerQualityCheck({
    reviewDecision: review.reviewDecision,
    routingReason,
    docEvidenceCount: retrieval.docEvidence.length,
    toolEvidenceCount: toolArtifacts.toolEvidence.length,
    totalClaims,
    invalidCitations,
    ...(docsGapReport ? { docsGapReport } : {}),
  });

  return {
    investigationId: persisted.investigationId,
    ticketId: persisted.ticketId,
    executionMode,
    mode: review.finalMode,
    supportLevel: review.supportLevel,
    reviewStatus: review.reviewStatus,
    reviewDecision: review.reviewDecision,
    routingReason,
    customerReply: generated.customerReply,
    internalDiagnosis: generated.internalDiagnosis,
    docEvidence: retrieval.docEvidence,
    toolEvidence: toolArtifacts.toolEvidence,
    toolCalls: toolArtifacts.toolCalls,
    pipelineTrace,
    qualityCheck,
    ...(docsGapReport ? { docsGapReport } : {}),
  } satisfies InvestigationResult;
}
