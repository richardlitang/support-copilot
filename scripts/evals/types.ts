import type { ReviewActionKind, ReviewReasonCode } from "../../lib/types/investigation";

export type EvalCase = {
  id: string;
  bucket: string;
  ticket: string;
  selectedAccountId?: string;
  expectation: string;
  expectedMode?: string;
  expectedReviewStatus?: string;
  expectedReviewReasonCode?: ReviewReasonCode;
  expectedReviewAction?: ReviewActionKind;
  expectedEvidenceKeywords?: string[];
  expectedClaimKeywords?: string[];
  forbiddenClaimKeywords?: string[];
  minDocEvidence?: number;
  requireToolEvidence?: boolean;
  requireCitedClaimsWhenReady?: boolean;
  expectedIgnoredDocStatuses?: Array<"uploaded" | "processing" | "failed">;
};

export type EvalSummary = {
  id: string;
  bucket: string;
  mode: string;
  reviewStatus: string;
  reviewReasonCode: string;
  reviewAction: string;
  supportLevel: string;
  insufficientSupport: boolean;
  customerClaims: number;
  internalClaims: number;
  citations: number;
  docEvidence: number;
  toolEvidence: number;
  toolCalls: number;
  selectedAccountId: string | null;
  expectedMode: string | null;
  expectedReviewStatus: string | null;
  expectedReviewReasonCode: string | null;
  expectedReviewAction: string | null;
  expectedEvidenceKeywords: string[];
  missingEvidenceKeywords: string[];
  expectedClaimKeywords: string[];
  missingClaimKeywords: string[];
  forbiddenClaimKeywords: string[];
  presentForbiddenClaimKeywords: string[];
  minDocEvidence: number | null;
  requireToolEvidence: boolean;
  routePassed: boolean;
  reviewPassed: boolean;
  reviewReasonCodePassed: boolean;
  reviewActionPassed: boolean;
  retrievalPassed: boolean;
  claimPassed: boolean;
  forbiddenClaimPassed: boolean;
  toolPassed: boolean;
  citationPassed: boolean;
  ignoredStatusPassed: boolean;
  passed: boolean;
  topDocs: Array<{
    id: string;
    filename: string;
    sectionTitle: string | null | undefined;
    score: number;
  }>;
  expectation: string;
};

export type RetrievalEvalSlice = "code" | "natural_language" | "semantic";

export type RetrievalGoldExpectation = {
  filenameIncludes?: string;
  sectionTitleIncludes?: string;
  contentIncludes: string[];
};

export type RetrievalEvalCase = {
  id: string;
  slice: RetrievalEvalSlice;
  query: string;
  sessionId?: string;
  expectedGold: RetrievalGoldExpectation;
};

export type RetrievalEvalSummary = {
  id: string;
  slice: RetrievalEvalSlice;
  query: string;
  inputRecallPassed: boolean;
  outputRecallPassed: boolean;
  rerankerInputCount: number;
  finalCount: number;
  matchedInputIds: string[];
  matchedFinalIds: string[];
};
