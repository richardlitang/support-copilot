import { classifyInvestigation } from "@/lib/classify";
import { detectConflict } from "@/lib/conflict-policy";
import {
  createInvestigation as createInvestigationAdapter,
  createTicket as createTicketAdapter,
  insertInvestigationSources as insertInvestigationSourcesAdapter,
  insertInvestigationToolCalls as insertInvestigationToolCallsAdapter,
  persistInvestigationRun as persistInvestigationRunAdapter
} from "@/lib/db";
import {
  buildStructuredHumanReviewFallback,
  generateGroundedAnswer as generateGroundedAnswerAdapter,
  generateInvestigationAnswer as generateInvestigationAnswerAdapter
} from "@/lib/answer";
import { buildLegacyAnswer, collectCitationIds, createDocEvidence, toLegacyClaims } from "@/lib/evidence-builder";
import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { retrieveEvidence as retrieveEvidenceAdapter } from "@/lib/retrieve";
import { determineSupportLevel } from "@/lib/support-level";
import { collectToolArtifacts, createSyntheticToolEvidence } from "@/lib/tool-runner";
import { getAccountContext as getAccountContextAdapter } from "@/lib/tools/account-context";
import { getFeatureFlags as getFeatureFlagsAdapter } from "@/lib/tools/feature-flags";
import { getRecentErrors as getRecentErrorsAdapter } from "@/lib/tools/recent-errors";
import type { GroundedClaim, SupportLevel, EvidenceChunk } from "@/lib/types";
import type {
  CitationId,
  InvestigationMode,
  InvestigationResult,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord
} from "@/lib/types/investigation";

type InvestigationDependencies = {
  createInvestigation: typeof createInvestigationAdapter;
  createTicket: typeof createTicketAdapter;
  insertInvestigationSources: typeof insertInvestigationSourcesAdapter;
  insertInvestigationToolCalls: typeof insertInvestigationToolCallsAdapter;
  persistInvestigationRun?: typeof persistInvestigationRunAdapter;
  retrieveEvidence: typeof retrieveEvidenceAdapter;
  generateGroundedAnswer: typeof generateGroundedAnswerAdapter;
  generateInvestigationAnswer: typeof generateInvestigationAnswerAdapter;
  getAccountContext: typeof getAccountContextAdapter;
  getFeatureFlags: typeof getFeatureFlagsAdapter;
  getRecentErrors: typeof getRecentErrorsAdapter;
};

const defaultDependencies: InvestigationDependencies = {
  createInvestigation: createInvestigationAdapter,
  createTicket: createTicketAdapter,
  insertInvestigationSources: insertInvestigationSourcesAdapter,
  insertInvestigationToolCalls: insertInvestigationToolCallsAdapter,
  persistInvestigationRun: persistInvestigationRunAdapter,
  retrieveEvidence: retrieveEvidenceAdapter,
  generateGroundedAnswer: generateGroundedAnswerAdapter,
  generateInvestigationAnswer: generateInvestigationAnswerAdapter,
  getAccountContext: getAccountContextAdapter,
  getFeatureFlags: getFeatureFlagsAdapter,
  getRecentErrors: getRecentErrorsAdapter
};

export async function investigateTicket(
  input: {
    ticket: string;
    ragEnabled: boolean;
    sessionId: string;
    selectedAccountId?: string | null;
    investigationContext?: string | null;
  },
  dependencies: Partial<InvestigationDependencies> = {}
) {
  const deps = {
    ...defaultDependencies,
    ...dependencies
  };

  const evidence = input.ragEnabled
    ? await deps.retrieveEvidence({
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
  const toolArtifacts = await collectToolArtifacts({
    requiredTools: routing.requiredTools,
    selectedAccountId: input.selectedAccountId,
    investigationContext: input.investigationContext,
    ticket: input.ticket,
    dependencies: deps
  });

  if (missingRequiredContext && toolArtifacts.toolEvidence.length === 0) {
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
  }

  const conflict = detectConflict({
    mode: routing.mode,
    ticket: input.ticket,
    docEvidence,
    account: toolArtifacts.account,
    flags: toolArtifacts.flags,
    errors: toolArtifacts.errors,
    missingRequiredContext
  });

  const firstCitation = (docEvidence[0]?.id ?? toolArtifacts.toolEvidence[0]?.id) as `S${number}` | `T${number}` | undefined;
  let generated;

  if (missingRequiredContext || conflict.hasConflict) {
    generated = buildStructuredHumanReviewFallback({
      customerMessage: firstCitation ? "I cannot confirm the cause without the required investigation context." : undefined,
      internalMessage: conflict.reason ?? "Structured product or account context required but not provided for this investigation.",
      citations: firstCitation ? [firstCitation] : [],
      openQuestions: missingRequiredContext
        ? ["Add investigation context or select a debug account and rerun the investigation."]
        : ["The docs and current tool state do not explain the issue."]
    });
  } else if (routing.mode === "docs_only") {
    if (!evidence.length) {
      generated = buildStructuredHumanReviewFallback({
        internalMessage: "Documentation evidence was too weak to support a grounded answer.",
        openQuestions: ["Add stronger documentation or rerun with investigation context if the issue is account-specific."]
      });
    } else {
      const legacy = await deps.generateGroundedAnswer({
        ticket: input.ticket,
        evidence
      });
      const legacyClaims = legacy.claims.map((claim) => ({
        text: claim.text,
        citations: claim.citationIds as CitationId[]
      }));

      generated =
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
    generated = await deps.generateInvestigationAnswer({
      ticket: input.ticket,
      mode: routing.mode,
      routingReason: routing.routingReason,
      docEvidence,
      toolEvidence: toolArtifacts.toolEvidence
    });
  }

  const validationFailed = "validationFailed" in generated && generated.validationFailed === true;
  const supportLevel = determineSupportLevel({
    topDocScore: docEvidence[0]?.score ?? 0,
    secondDocScore: docEvidence[1]?.score ?? 0,
    docEvidenceCount: docEvidence.length,
    toolEvidenceCount: toolArtifacts.toolEvidence.length,
    customerClaimCount: generated.customerReply.claims.length,
    internalClaimCount: generated.internalDiagnosis.claims.length,
    hasConflict: conflict.hasConflict,
    missingRequiredContext,
    validationFailed
  });
  const reviewStatus = determineReviewStatus({
    mode: routing.mode,
    supportLevel,
    hasConflict: conflict.hasConflict,
    missingRequiredContext,
    validationFailed
  });
  const finalMode: InvestigationMode =
    reviewStatus === "needs_human_review" || shouldEscalateToHumanReview({
      hasConflict: conflict.hasConflict,
      missingRequiredContext,
      supportLevel,
      validationFailed
    })
      ? "needs_human_review"
      : routing.mode;
  const answerMarkdown = buildLegacyAnswer(generated.customerReply.claims);
  const persistenceInput = {
    ticketText: input.ticket,
    status: reviewStatus === "needs_human_review" ? "needs_human_review" : "complete",
    answerMarkdown,
    supportLevel,
    mode: finalMode,
    reviewStatus,
    routingReason: conflict.reason ?? routing.routingReason,
    accountId: input.selectedAccountId ?? null,
    customerReplyJson: generated.customerReply,
    internalDiagnosisJson: generated.internalDiagnosis,
    sources: evidence.map((item: EvidenceChunk) => ({
      documentChunkId: item.id,
      rank: item.rank,
      score: item.score
    })),
    toolCalls: toolArtifacts.toolCalls.map((toolCall: ToolCallRecord) => ({
      toolName: toolCall.toolName,
      input: toolCall.input,
      output: toolCall.output
    }))
  };
  const persisted = deps.persistInvestigationRun
    ? await deps.persistInvestigationRun(persistenceInput)
    : await persistInvestigationRunWithLegacyAdapters({
        input: persistenceInput,
        dependencies: deps
      });

  const citations = collectCitationIds({
    customerReply: generated.customerReply,
    internalDiagnosis: generated.internalDiagnosis
  });

  return {
    investigationId: persisted.investigationId,
    ticketId: persisted.ticketId,
    mode: finalMode,
    supportLevel,
    reviewStatus,
    routingReason: conflict.reason ?? routing.routingReason,
    customerReply: generated.customerReply,
    internalDiagnosis: generated.internalDiagnosis,
    docEvidence,
    toolEvidence: toolArtifacts.toolEvidence,
    toolCalls: toolArtifacts.toolCalls,
    answer: answerMarkdown,
    claims: toLegacyClaims(generated.customerReply.claims),
    citations,
    evidence,
    insufficientSupport: supportLevel === "insufficient_support"
  } satisfies InvestigationResult & {
    answer: string;
    claims: GroundedClaim[];
    citations: string[];
    evidence: EvidenceChunk[];
    insufficientSupport: boolean;
  };
}

async function persistInvestigationRunWithLegacyAdapters(input: {
  input: Parameters<typeof persistInvestigationRunAdapter>[0];
  dependencies: InvestigationDependencies;
}) {
  const ticketId = await input.dependencies.createTicket(input.input.ticketText);
  const investigationId = await input.dependencies.createInvestigation({
    ticketId,
    status: input.input.status,
    answerMarkdown: input.input.answerMarkdown,
    supportLevel: input.input.supportLevel,
    mode: input.input.mode,
    reviewStatus: input.input.reviewStatus,
    routingReason: input.input.routingReason,
    accountId: input.input.accountId ?? null,
    customerReplyJson: input.input.customerReplyJson,
    internalDiagnosisJson: input.input.internalDiagnosisJson
  });

  await input.dependencies.insertInvestigationSources(
    input.input.sources.map((source) => ({
      investigationId,
      documentChunkId: source.documentChunkId,
      rank: source.rank,
      score: source.score
    }))
  );
  await input.dependencies.insertInvestigationToolCalls(
    input.input.toolCalls.map((toolCall) => ({
      investigationId,
      toolName: toolCall.toolName,
      input: toolCall.input,
      output: toolCall.output
    }))
  );

  return {
    ticketId,
    investigationId
  };
}
