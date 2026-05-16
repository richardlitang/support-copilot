import { classifyInvestigation as classifyInvestigationAdapter } from "@/lib/classify";
import { markInvestigationGraphStep } from "@/lib/experimental/graph/investigation-state";
import type { RoutingDecision } from "@/lib/classify";
import type { EvidenceChunk } from "@/lib/types";
import type { InvestigationGraphState } from "@/lib/experimental/graph/investigation-state";

export type ClassifyInvestigationDependencies = {
  classifyInvestigation: (input: {
    ticketText: string;
    selectedAccountId?: string | null;
    investigationContext?: string | null;
    evidence: EvidenceChunk[];
  }) => RoutingDecision;
};

const defaultDependencies: ClassifyInvestigationDependencies = {
  classifyInvestigation: classifyInvestigationAdapter,
};

export function classifyInvestigationNode(
  state: InvestigationGraphState,
  dependencies: Partial<ClassifyInvestigationDependencies> = {},
): InvestigationGraphState {
  const deps = {
    ...defaultDependencies,
    ...dependencies,
  };
  const routing = deps.classifyInvestigation({
    ticketText: state.input.ticket,
    selectedAccountId: state.input.selectedAccountId,
    investigationContext: state.input.investigationContext,
    evidence: state.retrievedEvidence,
  });
  const missingRequiredContext =
    routing.mode === "needs_human_review" &&
    !state.input.selectedAccountId &&
    !state.input.investigationContext?.trim();

  return markInvestigationGraphStep(
    {
      ...state,
      routing,
      missingRequiredContext,
    },
    "classified_investigation",
  );
}
