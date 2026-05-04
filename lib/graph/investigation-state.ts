import type { RoutingDecision } from "@/lib/classify";
import type { EvidenceChunk, SupportLevel } from "@/lib/types";
import type {
  AccountRecord,
  DocEvidenceItem,
  ErrorEventRecord,
  FeatureFlagRecord,
  ReviewDecision,
  ReviewStatus,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord,
  ToolEvidenceItem
} from "@/lib/types/investigation";

export type InvestigationGraphStep =
  | "initialized"
  | "retrieved_documentation"
  | "classified_investigation"
  | "ran_context_tools"
  | "built_evidence"
  | "generated_claims"
  | "validated_grounding"
  | "applied_review_policy"
  | "persisted_investigation";

export interface InvestigationGraphInput {
  ticket: string;
  sessionId: string;
  ragEnabled: boolean;
  selectedAccountId?: string | null;
  investigationContext?: string | null;
}

export interface ToolArtifactState {
  toolEvidence: ToolEvidenceItem[];
  toolCalls: ToolCallRecord[];
  account: AccountRecord | null;
  flags: FeatureFlagRecord[];
  errors: ErrorEventRecord[];
  productArea: string | null;
}

export interface ClaimDraftState {
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  insufficientSupport: boolean;
}

export interface GroundingValidationState {
  validationFailed: boolean;
  validCitationIds: string[];
  missingCitationIds: string[];
}

export interface ReviewPolicyState {
  supportLevel: SupportLevel;
  reviewStatus: ReviewStatus;
  reviewDecision: ReviewDecision;
  finalMode: RoutingDecision["mode"];
  routingReason: string;
}

export interface PersistenceState {
  ticketId?: string;
  investigationId?: string;
}

export interface InvestigationGraphState {
  input: InvestigationGraphInput;
  steps: InvestigationGraphStep[];
  retrievedEvidence: EvidenceChunk[];
  routing: RoutingDecision | null;
  docEvidence: DocEvidenceItem[];
  toolArtifacts: ToolArtifactState;
  claimDraft: ClaimDraftState | null;
  grounding: GroundingValidationState | null;
  review: ReviewPolicyState | null;
  persistence: PersistenceState;
  missingRequiredContext: boolean;
  hasConflict: boolean;
  conflictReason: string | null;
}

export function createInitialInvestigationGraphState(input: InvestigationGraphInput): InvestigationGraphState {
  return {
    input,
    steps: ["initialized"],
    retrievedEvidence: [],
    routing: null,
    docEvidence: [],
    toolArtifacts: {
      toolEvidence: [],
      toolCalls: [],
      account: null,
      flags: [],
      errors: [],
      productArea: null
    },
    claimDraft: null,
    grounding: null,
    review: null,
    persistence: {},
    missingRequiredContext: false,
    hasConflict: false,
    conflictReason: null
  };
}

export function markInvestigationGraphStep(
  state: InvestigationGraphState,
  step: InvestigationGraphStep
): InvestigationGraphState {
  if (state.steps.includes(step)) {
    return state;
  }

  return {
    ...state,
    steps: [...state.steps, step]
  };
}
