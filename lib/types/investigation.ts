import type { SupportLevel } from "@/lib/types";

export type InvestigationMode = "docs_only" | "docs_plus_tools" | "needs_human_review";
export type InvestigationBlocker =
  | { kind: "none" }
  | { kind: "missing_context" }
  | { kind: "conflict"; reason: string }
  | { kind: "validation_failed" };
export type InvestigationExecutionMode = "evidence_only" | "draft_answer";
export type ReviewStatus = "ready" | "needs_human_review";
export type ReviewReasonCode =
  | "none"
  | "weak_retrieval"
  | "missing_account_context"
  | "unresolved_evidence_conflict"
  | "grounding_validation_failed";
export type ReviewActionKind =
  | "none"
  | "add_context"
  | "add_docs"
  | "inspect_conflict"
  | "review_claims";
export type ToolName =
  | "getAccountContext"
  | "getFeatureFlags"
  | "getRecentErrors"
  | "getProvidedContext";
export type CitationId = `S${number}` | `T${number}`;
export type DocsGapType =
  | "unsupported_by_docs"
  | "missing_context"
  | "evidence_conflict"
  | "grounding_failed";

export interface ReviewDecision {
  status: ReviewStatus;
  reasonCode: ReviewReasonCode;
  action: ReviewActionKind;
}

export interface StructuredClaim {
  text: string;
  citations: CitationId[];
}

export interface StructuredClaimSet {
  summary?: string;
  claims: StructuredClaim[];
}

export interface StructuredClaimSetWithOpenQuestions extends StructuredClaimSet {
  openQuestions: string[];
}

export interface DocEvidenceItem {
  id: `S${number}`;
  sourceType: "doc";
  documentId: string;
  filename: string;
  sectionTitle?: string | null;
  excerpt: string;
  score: number;
  chunkIndex: number;
  retrievalSource?: "vector" | "literal" | "hybrid";
  vectorScore?: number;
  literalMatches?: string[];
  rerankScore?: number;
}

export interface ToolEvidenceItem {
  id: `T${number}`;
  sourceType: "tool";
  toolName: ToolName;
  title: string;
  excerpt: string;
  raw: unknown;
}

export interface ToolCallRecord {
  toolName: ToolName;
  input: Record<string, unknown>;
  output: unknown;
}

export interface PipelineTraceStep {
  id: string;
  label: string;
  status: "complete" | "skipped" | "blocked";
  summary: string;
  input?: unknown;
  output?: unknown;
}

export interface DocsGapEvidenceSnapshot {
  id: CitationId;
  sourceType: "doc" | "tool";
  title: string;
  excerpt: string;
  score?: number;
}

export interface DocsGapReport {
  gapType: DocsGapType;
  whatTicketNeeded: string;
  whyDocsFailed: string;
  suggestedNextAction: string;
  missingInformation: string[];
  evidenceSnapshot: DocsGapEvidenceSnapshot[];
}

export interface AnswerQualityCheck {
  retrieval: {
    sourceCount: number;
    topK: number;
    ignoredDocStatuses: Array<"uploaded" | "processing" | "failed">;
  };
  grounding: {
    totalClaims: number;
    supportedClaims: number;
    weakClaims: number;
    unsupportedClaims: number;
    invalidCitations: number;
  };
  readiness: {
    status: "ready" | "needs_human_review" | "blocked";
    reasons: string[];
  };
  missingInfo: {
    hasDocsGap: boolean;
    missingItems: string[];
  };
}

export interface InvestigationResult {
  investigationId: string;
  ticketId: string;
  executionMode: InvestigationExecutionMode;
  mode: InvestigationMode;
  supportLevel: SupportLevel;
  reviewStatus: ReviewStatus;
  reviewDecision: ReviewDecision;
  routingReason: string;
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
  toolCalls: ToolCallRecord[];
  pipelineTrace: PipelineTraceStep[];
  qualityCheck: AnswerQualityCheck;
  docsGapReport?: DocsGapReport;
}

export interface AccountRecord {
  id: string;
  name: string;
  planTier: string;
  status: string;
  enabledModules: string[];
  limits: Record<string, unknown>;
  createdAt: string;
}

export interface FeatureFlagRecord {
  id: string;
  accountId: string;
  flagKey: string;
  flagValue: boolean;
  description: string | null;
  rolloutNotes: string | null;
  createdAt: string;
}

export interface ErrorEventRecord {
  id: string;
  accountId: string;
  productArea: string | null;
  errorCode: string;
  summary: string;
  occurredAt: string;
  createdAt: string;
}
