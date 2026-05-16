import {
  createDocumentRecordDirect,
  deleteDocumentByIdRecord,
  deleteDocumentsByFilenameAndStatusRecord,
  deleteDocumentsBySessionIdRecord,
  getDocumentCountRecord,
  listDocumentsRecord,
  updateDocumentRecordStatus,
} from "@/src/server/db/documentRecords";
import { insertDocumentChunksRecord } from "@/src/server/db/documentChunkWrites";
import { persistInvestigationRunDirect } from "@/src/server/db/investigations";
import { matchDocumentChunksDb, matchLiteralDocumentChunksDb } from "@/src/server/db/retrieval";
import { getSupabaseAdminClient, hasDatabaseConfig } from "@/src/server/db/supabaseAdmin";
import {
  getAccountByIdDirect,
  listAccountsDirect,
  listFeatureFlagsByAccountIdDirect,
  listRecentErrorsByAccountIdDirect,
} from "@/src/server/db/supportContext";
import type {
  InvestigationMode,
  ReviewDecision,
  ReviewStatus,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord,
} from "@/lib/types/investigation";
import type { ChunkCandidate, DocumentStatus, EvidenceChunk, SupportLevel } from "@/lib/types";

function emitPerf(event: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      route: "db",
      event,
      ...(data ?? {}),
    }),
  );
}

export { getSupabaseAdminClient, hasDatabaseConfig };

export async function listDocuments(sessionId: string) {
  return listDocumentsRecord(sessionId);
}

export async function listDocumentsSafe(sessionId?: string | null) {
  if (!hasDatabaseConfig() || !sessionId) {
    emitPerf("listDocumentsSafe_skipped", {
      hasDatabaseConfig: hasDatabaseConfig(),
      hasSessionId: Boolean(sessionId),
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const documents = await listDocuments(sessionId);
    emitPerf("listDocumentsSafe_completed", {
      sessionId,
      documentCount: documents.length,
      durationMs: Date.now() - startedAt,
    });
    return documents;
  } catch (error) {
    emitPerf("listDocumentsSafe_failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function getDocumentCount(sessionId: string) {
  return getDocumentCountRecord(sessionId);
}

export async function createDocumentRecord(input: {
  sessionId: string;
  filename: string;
  contentType: string | null;
  status?: DocumentStatus;
  storagePath?: string | null;
  sizeBytes?: number | null;
}) {
  return createDocumentRecordDirect(input);
}

export async function updateDocumentStatus(documentId: string, status: DocumentStatus) {
  return updateDocumentRecordStatus(documentId, status);
}

export async function deleteDocumentsByFilenameAndStatus(
  filename: string,
  status: DocumentStatus,
  sessionId: string,
) {
  return deleteDocumentsByFilenameAndStatusRecord(filename, status, sessionId);
}

export async function deleteDocumentById(documentId: string, sessionId: string) {
  return deleteDocumentByIdRecord(documentId, sessionId);
}

export async function deleteDocumentsBySessionId(sessionId: string) {
  return deleteDocumentsBySessionIdRecord(sessionId);
}

export async function insertDocumentChunks(
  rows: Array<ChunkCandidate & { documentId: string; embedding: number[] }>,
) {
  return insertDocumentChunksRecord(rows);
}

export async function persistInvestigationRun(input: {
  ticketText: string;
  status: string;
  answerMarkdown: string;
  supportLevel: SupportLevel;
  mode: InvestigationMode;
  reviewStatus: ReviewStatus;
  reviewDecision: ReviewDecision;
  routingReason: string;
  accountId?: string | null;
  customerReplyJson: StructuredClaimSet;
  internalDiagnosisJson: StructuredClaimSetWithOpenQuestions;
  sources: Array<{
    documentChunkId: string;
    rank: number;
    score: number;
  }>;
  toolCalls: Array<{
    toolName: ToolCallRecord["toolName"];
    input: Record<string, unknown>;
    output: unknown;
  }>;
}) {
  return persistInvestigationRunDirect(input);
}

export async function matchDocumentChunks(input: {
  sessionId: string;
  queryEmbedding: number[];
  matchCount: number;
  matchThreshold: number;
}): Promise<EvidenceChunk[]> {
  return matchDocumentChunksDb(input);
}

export async function matchLiteralDocumentChunks(input: {
  sessionId: string;
  literals: string[];
  matchCount: number;
}): Promise<EvidenceChunk[]> {
  return matchLiteralDocumentChunksDb(input);
}

export async function listAccounts() {
  return listAccountsDirect();
}

export async function listAccountsSafe() {
  if (!hasDatabaseConfig()) {
    emitPerf("listAccountsSafe_skipped", {
      hasDatabaseConfig: false,
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const accounts = await listAccounts();
    emitPerf("listAccountsSafe_completed", {
      accountCount: accounts.length,
      durationMs: Date.now() - startedAt,
    });
    return accounts;
  } catch (error) {
    emitPerf("listAccountsSafe_failed", {
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function getAccountById(accountId: string) {
  return getAccountByIdDirect(accountId);
}

export async function listFeatureFlagsByAccountId(accountId: string) {
  return listFeatureFlagsByAccountIdDirect(accountId);
}

export async function listRecentErrorsByAccountId(input: {
  accountId: string;
  productArea?: string | null;
  limit?: number;
}) {
  return listRecentErrorsByAccountIdDirect(input);
}
