import { classifyInvestigation, type RoutingDecision } from "@/lib/classify";
import { getRetrievalLimit } from "@/src/server/retrieval/retrieve";
import { createDocEvidence } from "@/lib/evidence-builder";
import { determineReviewDecision } from "@/lib/review-decision";
import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { determineSupportLevel } from "@/lib/support-level";
import { collectToolArtifacts, createSyntheticToolEvidence } from "@/lib/tool-runner";
import type { ToolRunnerDependencies } from "@/lib/tool-runner";
import type { EvidenceChunk } from "@/lib/types";
import type {
  InvestigationBlocker,
  InvestigationExecutionMode,
  InvestigationMode,
  ToolCallRecord,
} from "@/lib/types/investigation";
import {
  generateClaimsFromEvidence,
  type ClaimGenerationDependencies,
  type ClaimGenerationResult,
} from "@/lib/claim-generation";
import { buildAnswerMarkdownFromClaims } from "@/lib/evidence-builder";

export type InvestigationDependencies = {
  persistInvestigationRun: (input: {
    ticketText: string;
    status: string;
    answerMarkdown: string;
    supportLevel: ReturnType<typeof determineSupportLevel>;
    mode: InvestigationMode;
    reviewStatus: ReturnType<typeof determineReviewStatus>;
    reviewDecision: ReturnType<typeof determineReviewDecision>;
    routingReason: string;
    accountId?: string | null;
    customerReplyJson: ClaimGenerationResult["customerReply"];
    internalDiagnosisJson: ClaimGenerationResult["internalDiagnosis"];
    sources: Array<{
      documentChunkId: string;
      rank: number;
      score: number;
    }>;
    toolCalls: Array<{
      toolName: ToolCallRecord["toolName"];
      input: Record<string, unknown>;
      output: unknown;
    }>;
  }) => Promise<{ ticketId: string; investigationId: string }>;
  retrieveEvidence: (input: {
    question: string;
    sessionId: string;
    limit: number;
  }) => Promise<EvidenceChunk[]>;
  generateGroundedAnswer: ClaimGenerationDependencies["generateGroundedAnswer"];
  generateInvestigationAnswer: ClaimGenerationDependencies["generateInvestigationAnswer"];
} & ToolRunnerDependencies;

export type InvestigationInput = {
  ticket: string;
  executionMode?: InvestigationExecutionMode;
  ragEnabled: boolean;
  sessionId: string;
  selectedAccountId?: string | null;
  investigationContext?: string | null;
};

export type ToolArtifacts = Awaited<ReturnType<typeof collectToolArtifacts>>;
export type GeneratedInvestigation = ClaimGenerationResult;

export async function retrieveAndRouteInvestigation(
  input: InvestigationInput,
  dependencies: InvestigationDependencies,
) {
  const evidence = input.ragEnabled
    ? await dependencies.retrieveEvidence({
        question: input.ticket,
        sessionId: input.sessionId,
        limit: getRetrievalLimit(),
      })
    : [];
  const docEvidence = createDocEvidence(evidence);
  const routing = classifyInvestigation({
    ticketText: input.ticket,
    selectedAccountId: input.selectedAccountId,
    investigationContext: input.investigationContext,
    evidence,
  });
  const blocker: InvestigationBlocker =
    routing.mode === "needs_human_review" &&
    !input.selectedAccountId &&
    !input.investigationContext?.trim()
      ? { kind: "missing_context" }
      : { kind: "none" };

  return {
    evidence,
    docEvidence,
    routing,
    blocker,
  };
}

export function buildEvidenceOnlyInvestigation(input: {
  blocker: InvestigationBlocker;
}): GeneratedInvestigation {
  const openQuestions: string[] = [];

  if (input.blocker.kind === "missing_context") {
    openQuestions.push(
      "Add investigation context or select a debug account before drafting an answer.",
    );
  }

  if (input.blocker.kind === "conflict") {
    openQuestions.push(input.blocker.reason);
  }

  return {
    customerReply: {
      claims: [],
    },
    internalDiagnosis: {
      claims: [],
      openQuestions,
    },
    insufficientSupport: true,
  };
}

export async function collectContextEvidence(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  routing: RoutingDecision;
  blocker: InvestigationBlocker;
}) {
  const toolArtifacts = await collectToolArtifacts({
    requiredTools: input.routing.requiredTools,
    selectedAccountId: input.input.selectedAccountId,
    investigationContext: input.input.investigationContext,
    ticket: input.input.ticket,
    dependencies: input.dependencies,
  });

  if (input.blocker.kind !== "missing_context" || toolArtifacts.toolEvidence.length > 0) {
    return toolArtifacts;
  }

  const synthetic = createSyntheticToolEvidence({
    toolName: "getProvidedContext",
    rank: 1,
    title: "Missing investigation context",
    excerpt:
      "This ticket appears to require structured product or account context, but none was provided.",
    raw: {
      status: "not_provided",
      context: null,
    },
  });
  toolArtifacts.toolEvidence.push(synthetic.evidence);
  toolArtifacts.toolCalls.push({
    ...synthetic.call,
    input: {
      context: null,
    },
  });

  return toolArtifacts;
}

export async function generateClaimsForInvestigation(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  evidence: EvidenceChunk[];
  docEvidence: ReturnType<typeof createDocEvidence>;
  routing: RoutingDecision;
  toolArtifacts: ToolArtifacts;
  blocker: InvestigationBlocker;
}): Promise<{ generated: GeneratedInvestigation; blocker: InvestigationBlocker }> {
  const generated = await generateClaimsFromEvidence(
    {
      ticket: input.input.ticket,
      mode: input.routing.mode,
      routingReason: input.routing.routingReason,
      evidence: input.evidence,
      docEvidence: input.docEvidence,
      toolEvidence: input.toolArtifacts.toolEvidence,
      blocker: input.blocker,
    },
    {
      generateGroundedAnswer: input.dependencies.generateGroundedAnswer,
      generateInvestigationAnswer: input.dependencies.generateInvestigationAnswer,
    },
  );
  const blocker: InvestigationBlocker =
    input.blocker.kind === "none" && generated.validationFailed
      ? { kind: "validation_failed" }
      : input.blocker;
  return { generated, blocker };
}

export function decideInvestigationReview(input: {
  routing: RoutingDecision;
  generated: GeneratedInvestigation;
  docEvidence: ReturnType<typeof createDocEvidence>;
  toolArtifacts: ToolArtifacts;
  blocker: InvestigationBlocker;
}) {
  const supportLevel = determineSupportLevel({
    topDocScore: input.docEvidence[0]?.score ?? 0,
    secondDocScore: input.docEvidence[1]?.score ?? 0,
    docEvidenceCount: input.docEvidence.length,
    toolEvidenceCount: input.toolArtifacts.toolEvidence.length,
    customerClaimCount: input.generated.customerReply.claims.length,
    internalClaimCount: input.generated.internalDiagnosis.claims.length,
    blocker: input.blocker,
  });
  const reviewStatus = determineReviewStatus({
    mode: input.routing.mode,
    supportLevel,
    blocker: input.blocker,
  });
  const finalMode: InvestigationMode =
    reviewStatus === "needs_human_review" ||
    shouldEscalateToHumanReview({ blocker: input.blocker, supportLevel })
      ? "needs_human_review"
      : input.routing.mode;

  return {
    finalMode,
    supportLevel,
    reviewStatus,
    reviewDecision: determineReviewDecision({
      reviewStatus,
      supportLevel,
      blocker: input.blocker,
    }),
  };
}

export async function persistInvestigation(input: {
  input: InvestigationInput;
  dependencies: InvestigationDependencies;
  generated: GeneratedInvestigation;
  evidence: EvidenceChunk[];
  toolArtifacts: ToolArtifacts;
  mode: InvestigationMode;
  reviewStatus: ReturnType<typeof determineReviewStatus>;
  reviewDecision: ReturnType<typeof determineReviewDecision>;
  supportLevel: ReturnType<typeof determineSupportLevel>;
  routingReason: string;
}) {
  const answerMarkdown = buildAnswerMarkdownFromClaims(input.generated.customerReply.claims);
  const persistenceInput = {
    ticketText: input.input.ticket,
    status: input.reviewStatus === "needs_human_review" ? "needs_human_review" : "complete",
    answerMarkdown,
    supportLevel: input.supportLevel,
    mode: input.mode,
    reviewStatus: input.reviewStatus,
    reviewDecision: input.reviewDecision,
    routingReason: input.routingReason,
    accountId: input.input.selectedAccountId ?? null,
    customerReplyJson: input.generated.customerReply,
    internalDiagnosisJson: input.generated.internalDiagnosis,
    sources: input.evidence.map((item: EvidenceChunk) => ({
      documentChunkId: item.id,
      rank: item.rank,
      score: item.score,
    })),
    toolCalls: input.toolArtifacts.toolCalls.map((toolCall: ToolCallRecord) => ({
      toolName: toolCall.toolName,
      input: toolCall.input,
      output: toolCall.output,
    })),
  };

  return input.dependencies.persistInvestigationRun(persistenceInput);
}
