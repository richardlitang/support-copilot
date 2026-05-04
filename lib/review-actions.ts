import type { InvestigationResult } from "@/lib/types/investigation";

export type ReviewActionKind = Exclude<InvestigationResult["reviewDecision"]["action"], "none">;

export interface ReviewAction {
  kind: ReviewActionKind;
  title: string;
  description: string;
  primaryActionLabel: string;
}

export function getReviewAction(result: InvestigationResult): ReviewAction | null {
  if (result.reviewStatus !== "needs_human_review") {
    return null;
  }

  if (result.reviewDecision.action === "add_context") {
    return {
      kind: "add_context",
      title: "Add missing account context",
      description: "The current run needs plan, feature, recent-error, or support-note context before it can produce a supported answer.",
      primaryActionLabel: "Add context and retry"
    };
  }

  if (result.reviewDecision.action === "add_docs") {
    return {
      kind: "add_docs",
      title: "Add stronger documentation",
      description: "The retrieved documentation was not enough to support the answer. Upload the missing runbook, FAQ, or policy doc and rerun.",
      primaryActionLabel: "Add docs and retry"
    };
  }

  if (result.reviewDecision.action === "inspect_conflict") {
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
