import { detectConflict } from "@/lib/conflict-policy";
import { buildDocsGapReport } from "@/lib/docs-gap-report";
import { persistInvestigationRun as persistInvestigationRunAdapter } from "@/src/server/db";
import {
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswer as generateInvestigationAnswerAdapter,
} from "@/src/server/ai/answer";
import { retrieveEvidence as retrieveEvidenceAdapter } from "@/src/server/retrieval/retrieve";
import { getAccountContext as getAccountContextAdapter } from "@/src/server/tools/account-context";
import { getFeatureFlags as getFeatureFlagsAdapter } from "@/src/server/tools/feature-flags";
import { getRecentErrors as getRecentErrorsAdapter } from "@/src/server/tools/recent-errors";
import type { InvestigationExecutionMode, InvestigationResult } from "@/lib/types/investigation";
import {
  buildEvidenceOnlyInvestigation,
  collectContextEvidence,
  decideInvestigationReview,
  generateClaimsForInvestigation,
  persistInvestigation,
  retrieveAndRouteInvestigation,
  type GeneratedInvestigation,
  type InvestigationDependencies,
  type InvestigationInput,
} from "@/src/server/investigation/stages";
import { buildAnswerQualityCheck } from "@/src/server/investigation/quality-check";
import { buildPipelineTrace } from "@/src/server/investigation/trace";

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
    blocker: retrieval.blocker,
  });

  const blocker = detectConflict({
    mode: retrieval.routing.mode,
    ticket: input.ticket,
    docEvidence: retrieval.docEvidence,
    account: toolArtifacts.account,
    flags: toolArtifacts.flags,
    errors: toolArtifacts.errors,
    blocker: retrieval.blocker,
  });

  const executionMode: InvestigationExecutionMode = input.executionMode ?? "draft_answer";
  let generated: GeneratedInvestigation;
  let finalBlocker = blocker;

  if (executionMode === "evidence_only") {
    generated = buildEvidenceOnlyInvestigation({ blocker });
  } else {
    const claimResult = await generateClaimsForInvestigation({
      input,
      dependencies: deps,
      evidence: retrieval.evidence,
      docEvidence: retrieval.docEvidence,
      routing: retrieval.routing,
      toolArtifacts,
      blocker,
    });
    generated = claimResult.generated;
    finalBlocker = claimResult.blocker;
  }

  const review = decideInvestigationReview({
    routing: retrieval.routing,
    generated,
    docEvidence: retrieval.docEvidence,
    toolArtifacts,
    blocker: finalBlocker,
  });
  const routingReason =
    finalBlocker.kind === "conflict" ? finalBlocker.reason : retrieval.routing.routingReason;
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
    blocker: finalBlocker,
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
