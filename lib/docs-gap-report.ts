import type {
  DocsGapReport,
  ReviewDecision,
  StructuredClaimSetWithOpenQuestions,
  ToolEvidenceItem,
} from "@/lib/types/investigation";
import type { DocEvidenceItem } from "@/lib/types/investigation";

function getGapType(decision: ReviewDecision): DocsGapReport["gapType"] {
  if (decision.reasonCode === "missing_account_context") {
    return "missing_context";
  }

  if (decision.reasonCode === "unresolved_evidence_conflict") {
    return "evidence_conflict";
  }

  if (decision.reasonCode === "grounding_validation_failed") {
    return "grounding_failed";
  }

  return "unsupported_by_docs";
}

function getSuggestedNextAction(decision: ReviewDecision) {
  if (decision.action === "add_context") {
    return "Add plan, feature-state, recent-error, or support-note context, then rerun the investigation.";
  }

  if (decision.action === "inspect_conflict") {
    return "Inspect the conflicting evidence and update the docs or product context before replying.";
  }

  if (decision.action === "review_claims") {
    return "Review the generated claims against the cited evidence before any customer-facing reply.";
  }

  return "Add or update documentation that directly answers this ticket, then rerun the investigation.";
}

function docTitle(item: DocEvidenceItem) {
  return item.sectionTitle ? `${item.filename} - ${item.sectionTitle}` : item.filename;
}

export function buildDocsGapReport(input: {
  ticket: string;
  reviewDecision: ReviewDecision;
  routingReason: string;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
}): DocsGapReport | undefined {
  if (input.reviewDecision.status !== "needs_human_review") {
    return undefined;
  }

  return {
    gapType: getGapType(input.reviewDecision),
    whatTicketNeeded: input.ticket,
    whyDocsFailed: input.routingReason,
    suggestedNextAction: getSuggestedNextAction(input.reviewDecision),
    missingInformation: input.internalDiagnosis.openQuestions,
    evidenceSnapshot: [
      ...input.docEvidence.slice(0, 3).map((item) => ({
        id: item.id,
        sourceType: "doc" as const,
        title: docTitle(item),
        excerpt: item.excerpt,
        score: item.score,
      })),
      ...input.toolEvidence.slice(0, 2).map((item) => ({
        id: item.id,
        sourceType: "tool" as const,
        title: `${item.toolName} - ${item.title}`,
        excerpt: item.excerpt,
      })),
    ],
  };
}
