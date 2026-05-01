import type { SupportLevel } from "@/lib/types";

export type InvestigationMode = "docs_only" | "docs_plus_tools" | "needs_human_review";
export type ReviewStatus = "ready" | "needs_human_review";
export type ToolName = "getAccountContext" | "getFeatureFlags" | "getRecentErrors" | "getProvidedContext";
export type CitationId = `S${number}` | `T${number}`;

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

export interface InvestigationResult {
  investigationId: string;
  ticketId: string;
  mode: InvestigationMode;
  supportLevel: SupportLevel;
  reviewStatus: ReviewStatus;
  routingReason: string;
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
  toolCalls: ToolCallRecord[];
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
