import { detectConflict as detectConflictAdapter } from "@/lib/conflict-policy";
import { createDocEvidence } from "@/lib/evidence-builder";
import { markInvestigationGraphStep } from "@/lib/graph/investigation-state";
import {
  collectToolArtifacts as collectToolArtifactsAdapter,
  createSyntheticToolEvidence,
  type ToolRunnerDependencies,
} from "@/lib/tool-runner";
import type { InvestigationGraphState, ToolArtifactState } from "@/lib/graph/investigation-state";

export type RunContextToolsDependencies = ToolRunnerDependencies & {
  collectToolArtifacts: typeof collectToolArtifactsAdapter;
  detectConflict: typeof detectConflictAdapter;
};

export async function runContextToolsNode(
  state: InvestigationGraphState,
  dependencies: RunContextToolsDependencies,
): Promise<InvestigationGraphState> {
  if (!state.routing) {
    throw new Error("Cannot run context tools before classification.");
  }

  const docEvidence = createDocEvidence(state.retrievedEvidence);
  const toolArtifacts = await dependencies.collectToolArtifacts({
    requiredTools: state.routing.requiredTools,
    selectedAccountId: state.input.selectedAccountId,
    investigationContext: state.input.investigationContext,
    ticket: state.input.ticket,
    dependencies,
  });

  const nextToolArtifacts: ToolArtifactState = {
    toolEvidence: [...toolArtifacts.toolEvidence],
    toolCalls: [...toolArtifacts.toolCalls],
    account: toolArtifacts.account,
    flags: toolArtifacts.flags,
    errors: toolArtifacts.errors,
    productArea: toolArtifacts.productArea,
  };

  if (state.missingRequiredContext && nextToolArtifacts.toolEvidence.length === 0) {
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
    nextToolArtifacts.toolEvidence.push(synthetic.evidence);
    nextToolArtifacts.toolCalls.push({
      ...synthetic.call,
      input: {
        context: null,
      },
    });
  }

  const conflict = dependencies.detectConflict({
    mode: state.routing.mode,
    ticket: state.input.ticket,
    docEvidence,
    account: nextToolArtifacts.account,
    flags: nextToolArtifacts.flags,
    errors: nextToolArtifacts.errors,
    missingRequiredContext: state.missingRequiredContext,
  });

  return markInvestigationGraphStep(
    {
      ...state,
      docEvidence,
      toolArtifacts: nextToolArtifacts,
      hasConflict: conflict.hasConflict,
      conflictReason: conflict.reason,
    },
    "ran_context_tools",
  );
}

export const defaultRunContextToolsAdapters = {
  collectToolArtifacts: collectToolArtifactsAdapter,
  detectConflict: detectConflictAdapter,
};
