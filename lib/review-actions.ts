import type { InvestigationResultV2 } from "@/lib/types/investigation-v2";

export type ReviewActionKind = "add_context" | "add_docs" | "inspect_conflict" | "review_claims";

export interface ReviewAction {
  kind: ReviewActionKind;
  title: string;
  description: string;
  primaryActionLabel: string;
}

export function getReviewAction(result: InvestigationResultV2): ReviewAction | null {
  if (result.reviewStatus !== "needs_human_review") {
    return null;
  }

  const reason = `${result.routingReason} ${result.internalDiagnosis.openQuestions.join(" ")}`.toLowerCase();

  if (reason.includes("none was provided") || reason.includes("required for this ticket")) {
    return {
      kind: "add_context",
      title: "Add missing account context",
      description: "The current run needs plan, feature, recent-error, or support-note context before it can produce a supported answer.",
      primaryActionLabel: "Add context and retry"
    };
  }

  if (!result.docEvidence.length || reason.includes("documentation") || reason.includes("stronger docs")) {
    return {
      kind: "add_docs",
      title: "Add stronger documentation",
      description: "The retrieved documentation was not enough to support the answer. Upload the missing runbook, FAQ, or policy doc and rerun.",
      primaryActionLabel: "Add docs and retry"
    };
  }

  if (reason.includes("context") || reason.includes("account")) {
    return {
      kind: "add_context",
      title: "Add missing account context",
      description: "The current run needs plan, feature, recent-error, or support-note context before it can produce a supported answer.",
      primaryActionLabel: "Add context and retry"
    };
  }

  if (reason.includes("conflict") || reason.includes("do not explain") || reason.includes("unresolved")) {
    return {
      kind: "inspect_conflict",
      title: "Resolve the evidence gap",
      description: "The documentation and tool state do not explain the reported issue. Inspect the evidence, add the missing context, then rerun.",
      primaryActionLabel: "Add context and retry"
    };
  }

  return {
    kind: "review_claims",
    title: "Review before sending",
    description: "The system could not verify enough cited claims for a ready answer. Review the evidence before replying to the customer.",
    primaryActionLabel: "Review evidence"
  };
}
