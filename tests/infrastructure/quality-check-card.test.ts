import { describe, expect, it } from "vitest";
import { QualityCheckCard } from "@/components/answer/quality-check-card";
import type { InvestigationResult } from "@/lib/types/investigation";

const legacyResult = {
  investigationId: "inv-1",
  ticketId: "ticket-1",
  executionMode: "draft_answer",
  mode: "docs_only",
  supportLevel: "high",
  reviewStatus: "ready",
  reviewDecision: { status: "ready", reasonCode: "none", action: "none" },
  routingReason: "Matched documentation.",
  customerReply: { claims: [] },
  internalDiagnosis: { claims: [], openQuestions: [] },
  docEvidence: [],
  toolEvidence: [],
  toolCalls: [],
  pipelineTrace: [],
  qualityCheck: {
    retrieval: {
      sourceCount: 1,
      topK: 5,
      ignoredDocStatuses: ["uploaded", "processing", "failed"],
    },
    grounding: {
      totalClaims: 0,
      supportedClaims: 0,
      weakClaims: 0,
      unsupportedClaims: 0,
      invalidCitations: 0,
    },
    missingInfo: {
      hasDocsGap: false,
      missingItems: [],
    },
  },
} as unknown as InvestigationResult;

describe("QualityCheckCard", () => {
  it("renders legacy quality checks without readiness metadata", () => {
    expect(() => QualityCheckCard({ result: legacyResult, showDebugDetails: false })).not.toThrow();
  });
});
