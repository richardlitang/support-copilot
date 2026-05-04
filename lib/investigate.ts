import { classifyInvestigation, type RoutingDecision } from "@/lib/classify";
import { detectConflict } from "@/lib/conflict-policy";
import { persistInvestigationRun as persistInvestigationRunAdapter } from "@/lib/db";
import {
  buildStructuredHumanReviewFallback,
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswer as generateInvestigationAnswerAdapter
} from "@/lib/answer";
import { buildLegacyAnswer, createDocEvidence } from "@/lib/evidence-builder";
import { determineReviewDecision } from "@/lib/review-decision";
import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { retrieveEvidence as retrieveEvidenceAdapter } from "@/lib/retrieve";
import { determineSupportLevel } from "@/lib/support-level";
import { collectToolArtifacts, createSyntheticToolEvidence } from "@/lib/tool-runner";
import { getAccountContext as getAccountContextAdapter } from "@/lib/tools/account-context";
import { getFeatureFlags as getFeatureFlagsAdapter } from "@/lib/tools/feature-flags";
import { getRecentErrors as getRecentErrorsAdapter } from "@/lib/tools/recent-errors";
import type { EvidenceChunk } from "@/lib/types";
import type {
  CitationId,
  InvestigationMode,
  InvestigationResult,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord
} from "@/lib/types/investigation";

type InvestigationDependencies = {
  persistInvestigationRun: typeof persistInvestigationRunAdapter;
  retrieveEvidence: typeof retrieveEvidenceAdapter;
  generateGroundedAnswer: typeof generateGroundedAnswerAdapter;
  generateInvestigationAnswer: typeof generateInvestigationAnswerAdapter;
  getAccountContext: typeof getAccountContextAdapter;
  getFeatureFlags: typeof getFeatureFlagsAdapter;
  getRecentErrors: typeof getRecentErrorsAdapter;
};

type InvestigationInput = {
  ticket: string;
  ragEnabled: boolean;
  sessionId: string;
  selectedAccountId?: string | null;
  investigationContext?: string | null;
};

type ToolArtifacts = Awaited<ReturnType<typeof collectToolArtifacts>>;

type GeneratedInvestigation = {
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  insufficientSupport: boolean;
  validationFailed?: boolean;
};

const defaultDependencies: InvestigationDependencies = {
  persistInvestigationRun: persistInvestigationRunAdapter,
  retrieveEvidence: retrieveEvidenceAdapter,
  generateGroundedAnswer: generateGroundedAnswerAdapter,
  generateInvestigationAnswer: generateInvestigationAnswerAdapter,
  getAccountContext: getAccountContextAdapter,
  getFeatureFlags: getFeatureFlagsAdapter,
  getRecentErrors: getRecentErrorsAdapter
};

export async function investigateTicket(
  input: InvestigationInput,
  dependencies: Partial<InvestigationDependencies> = {}
) {
  const deps = {
    ...defaultDependencies,
    ...dependencies
  };

  const retrieval = await retrieveAndRouteInvestigation(input, deps);
  const toolArtifacts = await collectContextEvidence({
    input,
    dependencies: deps,
    routing: retrieval.routing,
    missingRequiredContext: retrieval.missingRequiredContext
  });

  const conflict = detectConflict({
    mode: retrieval.routing.mode,
    ticket: input.ticket,
    docEvidence: retrieval.docEvidence,
    account: toolArtifacts.account,
    flags: toolArtifacts.flags,
    errors: toolArtifacts.errors,
    missingRequiredContext: retrieval.missingRequiredContext
  });
  const generated = await generateClaimsForInvestigation({
    input,
    dependencies: deps,
    evidence: retrieval.evidence,
    docEvidence: retrieval.docEvidence,
    routing: retrieval.routing,
    toolArtifacts,
    missingRequiredContext: retrieval.missingRequiredContext,
    hasConflict: conflict.hasConflict,
    conflictReason: conflict.reason
  });
  const review = decideInvestigationReview({
    routing: retrieval.routing,
    generated,
    docEvidence: retrieval.docEvidence,
    toolArtifacts,
    missingRequiredContext: retrieval.missingRequiredContext,
    hasConflict: conflict.hasConflict
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
    supportLevel: review.supportLevel,
    routingReason
  });

  return {
    investigationId: persisted.investigationId,
    ticketId: persisted.ticketId,
    mode: review.finalMode,
    supportLevel: review.supportLevel,
    reviewStatus: review.reviewStatus,
    reviewDecision: review.reviewDecision,
    routingReason,
    customerReply: generated.customerReply,
    internalDiagnosis: generated.internalDiagnosis,
    docEvidence: retrieval.docEvidence,
    toolEvidence: toolArtifacts.toolEvidence,
    toolCalls: toolArtifacts.toolCalls
  } satisfies InvestigationResult;
}

async function retrieveAndRouteInvestigation(input: InvestigationInput, dependencies: InvestigationDependencies) {
  const evidence = input.ragEnabled
    ? await dependencies.retrieveEvidence({
        question: input.ticket,
        sessionId: input.sessionId,
        limit: 8
      })
    : [];
  const docEvidence = createDocEvidence(evidence);
  const routing = classifyInvestigation({
    ticketText: input.ticket,
    selectedAccountId: input.selectedAccountId,
    investigationContext: input.investigationContext,
    evidence
  });
  const missingRequiredContext =
    routing.mode === "needs_human_review" &&
    !input.selectedAccountId &&
    !input.investigationContext?.trim();

  return {
    evidence,
    docEvidence,
    routing,
    missingRequiredContext
  };
}

async function collectContextEvidence(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  routing: RoutingDecision;
  missingRequiredContext: boolean;
}) {
  const toolArtifacts = await collectToolArtifacts({
    requiredTools: input.routing.requiredTools,
    selectedAccountId: input.input.selectedAccountId,
    investigationContext: input.input.investigationContext,
    ticket: input.input.ticket,
    dependencies: input.dependencies
  });

  if (!input.missingRequiredContext || toolArtifacts.toolEvidence.length > 0) {
    return toolArtifacts;
  }

  const synthetic = createSyntheticToolEvidence({
    toolName: "getProvidedContext",
    rank: 1,
    title: "Missing investigation context",
    excerpt: "This ticket appears to require structured product or account context, but none was provided.",
    raw: {
      status: "not_provided",
      context: null
    }
  });
  toolArtifacts.toolEvidence.push(synthetic.evidence);
  toolArtifacts.toolCalls.push({
    ...synthetic.call,
    input: {
      context: null
    }
  });

  return toolArtifacts;
}

async function generateClaimsForInvestigation(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  evidence: EvidenceChunk[];
  docEvidence: ReturnType<typeof createDocEvidence>;
  routing: RoutingDecision;
  toolArtifacts: ToolArtifacts;
  missingRequiredContext: boolean;
  hasConflict: boolean;
  conflictReason: string | null;
}): Promise<GeneratedInvestigation> {
  const firstCitation = (input.docEvidence[0]?.id ?? input.toolArtifacts.toolEvidence[0]?.id) as
    | `S${number}`
    | `T${number}`
    | undefined;

  if (input.missingRequiredContext || input.hasConflict) {
    return buildStructuredHumanReviewFallback({
      customerMessage: firstCitation ? "I cannot confirm the cause without the required investigation context." : undefined,
      internalMessage: input.conflictReason ?? "Structured product or account context required but not provided for this investigation.",
      citations: firstCitation ? [firstCitation] : [],
      openQuestions: input.missingRequiredContext
        ? ["Add investigation context or select a debug account and rerun the investigation."]
        : ["The docs and current tool state do not explain the issue."]
    });
  }

  if (input.routing.mode === "docs_only") {
    if (!input.evidence.length) {
      return buildStructuredHumanReviewFallback({
        internalMessage: "Documentation evidence was too weak to support a grounded answer.",
        openQuestions: ["Add stronger documentation or rerun with investigation context if the issue is account-specific."]
      });
    }

    const legacy = await input.dependencies.generateGroundedAnswer({
      ticket: input.input.ticket,
      evidence: input.evidence
    });
    const legacyClaims = legacy.claims.map((claim) => ({
      text: claim.text,
      citations: claim.citationIds as CitationId[]
    }));

    return !legacyClaims.length && legacy.insufficientSupport
      ? buildStructuredHumanReviewFallback({
          customerMessage: firstCitation ? "I do not have enough support in the uploaded docs to answer this confidently." : undefined,
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

  return input.dependencies.generateInvestigationAnswer({
    ticket: input.input.ticket,
    mode: input.routing.mode,
    routingReason: input.routing.routingReason,
    docEvidence: input.docEvidence,
    toolEvidence: input.toolArtifacts.toolEvidence
  });
}

function decideInvestigationReview(input: {
  routing: RoutingDecision;
  generated: GeneratedInvestigation;
  docEvidence: ReturnType<typeof createDocEvidence>;
  toolArtifacts: ToolArtifacts;
  missingRequiredContext: boolean;
  hasConflict: boolean;
}) {
  const validationFailed = "validationFailed" in input.generated && input.generated.validationFailed === true;
  const supportLevel = determineSupportLevel({
    topDocScore: input.docEvidence[0]?.score ?? 0,
    secondDocScore: input.docEvidence[1]?.score ?? 0,
    docEvidenceCount: input.docEvidence.length,
    toolEvidenceCount: input.toolArtifacts.toolEvidence.length,
    customerClaimCount: input.generated.customerReply.claims.length,
    internalClaimCount: input.generated.internalDiagnosis.claims.length,
    hasConflict: input.hasConflict,
    missingRequiredContext: input.missingRequiredContext,
    validationFailed
  });
  const reviewStatus = determineReviewStatus({
    mode: input.routing.mode,
    supportLevel,
    hasConflict: input.hasConflict,
    missingRequiredContext: input.missingRequiredContext,
    validationFailed
  });
  const finalMode: InvestigationMode =
    reviewStatus === "needs_human_review" || shouldEscalateToHumanReview({
      hasConflict: input.hasConflict,
      missingRequiredContext: input.missingRequiredContext,
      supportLevel,
      validationFailed
    })
      ? "needs_human_review"
      : input.routing.mode;

  return {
    finalMode,
    supportLevel,
    reviewStatus,
    reviewDecision: determineReviewDecision({
      reviewStatus,
      supportLevel,
      missingRequiredContext: input.missingRequiredContext,
      hasConflict: input.hasConflict,
      validationFailed
    })
  };
}

async function persistInvestigation(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  generated: GeneratedInvestigation;
  evidence: EvidenceChunk[];
  toolArtifacts: ToolArtifacts;
  mode: InvestigationMode;
  reviewStatus: ReturnType<typeof determineReviewStatus>;
  supportLevel: ReturnType<typeof determineSupportLevel>;
  routingReason: string;
}) {
  const answerMarkdown = buildLegacyAnswer(input.generated.customerReply.claims);
  const persistenceInput = {
    ticketText: input.input.ticket,
    status: input.reviewStatus === "needs_human_review" ? "needs_human_review" : "complete",
    answerMarkdown,
    supportLevel: input.supportLevel,
    mode: input.mode,
    reviewStatus: input.reviewStatus,
    routingReason: input.routingReason,
    accountId: input.input.selectedAccountId ?? null,
    customerReplyJson: input.generated.customerReply,
    internalDiagnosisJson: input.generated.internalDiagnosis,
    sources: input.evidence.map((item: EvidenceChunk) => ({
      documentChunkId: item.id,
      rank: item.rank,
      score: item.score
    })),
    toolCalls: input.toolArtifacts.toolCalls.map((toolCall: ToolCallRecord) => ({
      toolName: toolCall.toolName,
      input: toolCall.input,
      output: toolCall.output
    }))
  };

  return input.dependencies.persistInvestigationRun(persistenceInput);
}
