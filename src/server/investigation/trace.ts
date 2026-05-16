import { createDocEvidence } from "@/lib/evidence-builder";
import type { EvidenceChunk } from "@/lib/types";
import type {
  InvestigationExecutionMode,
  PipelineTraceStep,
  ToolEvidenceItem,
} from "@/lib/types/investigation";
import type { RoutingDecision } from "@/lib/classify";
import type {
  GeneratedInvestigation,
  InvestigationInput,
  ToolArtifacts,
} from "@/src/server/investigation/stages";

function summarizeEvidence(items: ReturnType<typeof createDocEvidence>) {
  return items.map((item) => ({
    id: item.id,
    filename: item.filename,
    sectionTitle: item.sectionTitle,
    score: item.score,
    retrievalSource: item.retrievalSource ?? "vector",
    vectorScore: item.vectorScore ?? null,
    rerankScore: item.rerankScore ?? null,
    literalMatches: item.literalMatches ?? [],
    excerpt: item.excerpt,
  }));
}

function summarizeToolEvidence(items: ToolArtifacts["toolEvidence"]) {
  return items.map((item: ToolEvidenceItem) => ({
    id: item.id,
    toolName: item.toolName,
    title: item.title,
    excerpt: item.excerpt,
    raw: item.raw,
  }));
}

export function buildPipelineTrace(input: {
  input: InvestigationInput;
  executionMode: InvestigationExecutionMode;
  evidence: EvidenceChunk[];
  docEvidence: ReturnType<typeof createDocEvidence>;
  routing: RoutingDecision;
  toolArtifacts: ToolArtifacts;
  hasConflict: boolean;
  conflictReason: string | null;
  generated: GeneratedInvestigation;
  review: {
    finalMode: string;
    supportLevel: string;
    reviewStatus: string;
    reviewDecision: unknown;
  };
  persisted: {
    ticketId: string;
    investigationId: string;
  };
}): PipelineTraceStep[] {
  const docEvidence = summarizeEvidence(input.docEvidence);
  const toolEvidence = summarizeToolEvidence(input.toolArtifacts.toolEvidence);
  const answerModelInput = {
    ticket: input.input.ticket,
    mode: input.routing.mode,
    routingReason: input.routing.routingReason,
    documentationEvidence: docEvidence,
    toolEvidence,
  };

  return [
    {
      id: "request",
      label: "Request received",
      status: "complete",
      summary: `${input.executionMode === "evidence_only" ? "Evidence-only" : "Draft-answer"} run started.`,
      input: {
        ticket: input.input.ticket,
        executionMode: input.executionMode,
        ragEnabled: input.input.ragEnabled,
        sessionId: input.input.sessionId,
        selectedAccountId: input.input.selectedAccountId ?? null,
        investigationContext: input.input.investigationContext ?? null,
      },
      output: {
        accepted: true,
      },
    },
    {
      id: "retrieval",
      label: "Documentation retrieval",
      status: input.input.ragEnabled ? "complete" : "skipped",
      summary: input.input.ragEnabled
        ? `Retrieved ${input.docEvidence.length} document source${input.docEvidence.length === 1 ? "" : "s"}.`
        : "Retrieval was disabled for this run.",
      input: {
        query: input.input.ticket,
        limit: 8,
      },
      output: docEvidence,
    },
    {
      id: "routing",
      label: "Route decision",
      status: "complete",
      summary: input.routing.routingReason,
      input: {
        ticket: input.input.ticket,
        evidenceIds: input.docEvidence.map((item) => item.id),
        selectedAccountId: input.input.selectedAccountId ?? null,
        hasInvestigationContext: Boolean(input.input.investigationContext?.trim()),
      },
      output: {
        mode: input.routing.mode,
        requiredTools: input.routing.requiredTools,
        routingReason: input.routing.routingReason,
      },
    },
    {
      id: "tools",
      label: "Tool context",
      status:
        input.routing.requiredTools.length || input.toolArtifacts.toolEvidence.length
          ? "complete"
          : "skipped",
      summary: input.toolArtifacts.toolEvidence.length
        ? `Collected ${input.toolArtifacts.toolEvidence.length} tool source${input.toolArtifacts.toolEvidence.length === 1 ? "" : "s"}.`
        : "No account or product-state tools were needed.",
      input: {
        requiredTools: input.routing.requiredTools,
        selectedAccountId: input.input.selectedAccountId ?? null,
        investigationContext: input.input.investigationContext ?? null,
      },
      output: {
        toolEvidence,
        toolCalls: input.toolArtifacts.toolCalls,
      },
    },
    {
      id: "conflict",
      label: "Conflict check",
      status: input.hasConflict ? "blocked" : "complete",
      summary: input.conflictReason ?? "No blocking conflict found between docs and context.",
      input: {
        mode: input.routing.mode,
        docEvidence,
        toolEvidence,
      },
      output: {
        hasConflict: input.hasConflict,
        reason: input.conflictReason,
      },
    },
    {
      id: "draft",
      label: "Answer drafting",
      status:
        input.executionMode === "evidence_only"
          ? "skipped"
          : input.generated.insufficientSupport
            ? "blocked"
            : "complete",
      summary:
        input.executionMode === "evidence_only"
          ? "Answer model was skipped. This run only returned inspectable evidence."
          : `Generated ${input.generated.customerReply.claims.length} customer claim${input.generated.customerReply.claims.length === 1 ? "" : "s"} and ${input.generated.internalDiagnosis.claims.length} internal finding${input.generated.internalDiagnosis.claims.length === 1 ? "" : "s"}.`,
      input: answerModelInput,
      output:
        input.executionMode === "evidence_only"
          ? {
              skipped: true,
            }
          : {
              customerReply: input.generated.customerReply,
              internalDiagnosis: input.generated.internalDiagnosis,
              insufficientSupport: input.generated.insufficientSupport,
            },
    },
    {
      id: "review",
      label: "Review policy",
      status: input.review.reviewStatus === "needs_human_review" ? "blocked" : "complete",
      summary:
        input.executionMode === "evidence_only"
          ? "No reply was drafted, so the result remains evidence-only."
          : input.review.reviewStatus === "ready"
            ? "Ready to review and send."
            : "Human review is required before replying.",
      input: {
        supportLevel: input.review.supportLevel,
        hasOpenQuestions: input.generated.internalDiagnosis.openQuestions.length > 0,
        hasConflict: input.hasConflict,
      },
      output: {
        mode: input.review.finalMode,
        supportLevel: input.review.supportLevel,
        reviewStatus: input.review.reviewStatus,
        reviewDecision: input.review.reviewDecision,
      },
    },
    {
      id: "persistence",
      label: "Persistence",
      status: "complete",
      summary: "Saved the ticket, sources, tool calls, and final investigation state.",
      input: {
        sourceCount: input.evidence.length,
        toolCallCount: input.toolArtifacts.toolCalls.length,
      },
      output: input.persisted,
    },
  ];
}
