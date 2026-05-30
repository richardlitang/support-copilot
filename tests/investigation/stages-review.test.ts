import { describe, expect, it } from "vitest";
import { decideInvestigationReview } from "@/src/server/investigation/stages";
import type { RoutingDecision } from "@/lib/classify";
import type { DocEvidenceItem } from "@/lib/types/investigation";
import type { GeneratedInvestigation, ToolArtifacts } from "@/src/server/investigation/stages";

function docItem(score: number, rank: number = 1): DocEvidenceItem {
  return {
    id: `S${rank}` as const,
    sourceType: "doc",
    documentId: "doc-1",
    filename: "guide.md",
    excerpt: "content",
    score,
    chunkIndex: 0,
  };
}

const routing: RoutingDecision = {
  mode: "docs_plus_tools",
  requiredTools: [],
  routingReason: "matched",
};

const strongGenerated: GeneratedInvestigation = {
  customerReply: { claims: [{ text: "Try X.", citations: [] }] },
  internalDiagnosis: { claims: [{ text: "Root cause Y.", citations: [] }], openQuestions: [] },
  insufficientSupport: false,
};

const emptyGenerated: GeneratedInvestigation = {
  customerReply: { claims: [] },
  internalDiagnosis: { claims: [], openQuestions: [] },
  insufficientSupport: true,
};

const noTools: ToolArtifacts = {
  toolEvidence: [],
  toolCalls: [],
  account: null,
  flags: [],
  errors: [],
  productArea: null,
};

describe("decideInvestigationReview", () => {
  it("keeps routing mode and marks ready when evidence is strong and blocker is none", () => {
    const result = decideInvestigationReview({
      routing,
      generated: strongGenerated,
      docEvidence: [docItem(0.85), docItem(0.72, 2)],
      toolArtifacts: noTools,
      blocker: { kind: "none" },
    });

    expect(result.finalMode).toBe("docs_plus_tools");
    expect(result.reviewStatus).toBe("ready");
    expect(result.supportLevel).toBe("high");
    expect(result.reviewDecision).toEqual({ status: "ready", reasonCode: "none", action: "none" });
  });

  it("escalates to needs_human_review when blocker is missing_context", () => {
    const result = decideInvestigationReview({
      routing,
      generated: strongGenerated,
      docEvidence: [docItem(0.85)],
      toolArtifacts: noTools,
      blocker: { kind: "missing_context" },
    });

    expect(result.finalMode).toBe("needs_human_review");
    expect(result.reviewStatus).toBe("needs_human_review");
    expect(result.reviewDecision.reasonCode).toBe("missing_account_context");
    expect(result.reviewDecision.action).toBe("add_context");
  });

  it("escalates to needs_human_review when blocker is conflict", () => {
    const result = decideInvestigationReview({
      routing,
      generated: strongGenerated,
      docEvidence: [docItem(0.85)],
      toolArtifacts: noTools,
      blocker: { kind: "conflict", reason: "Docs say A, tool data says B." },
    });

    expect(result.finalMode).toBe("needs_human_review");
    expect(result.reviewDecision.reasonCode).toBe("unresolved_evidence_conflict");
    expect(result.reviewDecision.action).toBe("inspect_conflict");
  });

  it("returns add_docs action when no evidence and no blocker", () => {
    const result = decideInvestigationReview({
      routing,
      generated: emptyGenerated,
      docEvidence: [],
      toolArtifacts: noTools,
      blocker: { kind: "none" },
    });

    expect(result.supportLevel).toBe("insufficient_support");
    expect(result.reviewStatus).toBe("needs_human_review");
    expect(result.reviewDecision.reasonCode).toBe("weak_retrieval");
    expect(result.reviewDecision.action).toBe("add_docs");
  });
});
