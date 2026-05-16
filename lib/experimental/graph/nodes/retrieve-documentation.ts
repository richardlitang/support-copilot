import { markInvestigationGraphStep } from "@/lib/experimental/graph/investigation-state";
import { retrieveEvidence as retrieveEvidenceAdapter } from "@/lib/retrieve";
import type { EvidenceChunk } from "@/lib/types";
import type { InvestigationGraphState } from "@/lib/experimental/graph/investigation-state";

export type RetrieveDocumentationDependencies = {
  retrieveEvidence: (input: {
    question: string;
    sessionId: string;
    limit?: number;
  }) => Promise<EvidenceChunk[]>;
};

const defaultDependencies: RetrieveDocumentationDependencies = {
  retrieveEvidence: retrieveEvidenceAdapter,
};

export async function retrieveDocumentationNode(
  state: InvestigationGraphState,
  dependencies: Partial<RetrieveDocumentationDependencies> = {},
): Promise<InvestigationGraphState> {
  const deps = {
    ...defaultDependencies,
    ...dependencies,
  };
  const retrievedEvidence = state.input.ragEnabled
    ? await deps.retrieveEvidence({
        question: state.input.ticket,
        sessionId: state.input.sessionId,
        limit: 8,
      })
    : [];

  return markInvestigationGraphStep(
    {
      ...state,
      retrievedEvidence,
    },
    "retrieved_documentation",
  );
}
