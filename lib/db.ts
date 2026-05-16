import { ensureEnvLoaded, hasDirectDatabaseConfig } from "@/lib/env";
import {
  createDocumentDirect,
  deleteDocumentDirect,
  deleteDocumentsBySessionDirect,
  getDocumentCountDirect,
  listDocumentsDirect,
  updateDocumentStatusDirect,
} from "@/src/server/db/documents";
import {
  matchDocumentChunksDirect,
  matchLiteralDocumentChunksDirect,
  replaceDocumentChunks,
} from "@/src/server/db/chunks";
import { withPgClient } from "@/src/server/db/client";
import {
  createInvestigationDirect,
  insertInvestigationSourcesDirect,
  insertInvestigationToolCallsDirect,
  persistInvestigationRunDirect,
} from "@/src/server/db/investigations";
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
import type {
  ChunkCandidate,
  DocumentRecord,
  DocumentStatus,
  EvidenceChunk,
  SupportLevel,
} from "@/lib/types";

type DbDocumentRow = {
  id: string;
  session_id: string | null;
  filename: string;
  content_type: string | null;
  status: DocumentStatus;
  created_at: string;
  storage_path?: string | null;
  size_bytes?: number | null;
  error_code?: string | null;
  error_message_safe?: string | null;
  processed_at?: string | null;
};

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

function mapDocumentRow(row: DbDocumentRow): DocumentRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    filename: row.filename,
    contentType: row.content_type,
    status: row.status,
    createdAt: row.created_at,
    storagePath: row.storage_path ?? null,
    sizeBytes: row.size_bytes ?? null,
    errorCode: row.error_code ?? null,
    errorMessageSafe: row.error_message_safe ?? null,
    processedAt: row.processed_at ?? null,
  };
}

export async function listDocuments(sessionId: string) {
  if (hasDirectDatabaseConfig()) {
    return listDocumentsDirect(sessionId);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, session_id, filename, content_type, status, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return (data ?? []).map((row) => mapDocumentRow(row as DbDocumentRow));
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
  if (hasDirectDatabaseConfig()) {
    return getDocumentCountDirect(sessionId);
  }

  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`Failed to count documents: ${error.message}`);
  }

  return count ?? 0;
}

export async function createDocumentRecord(input: {
  sessionId: string;
  filename: string;
  contentType: string | null;
  status?: DocumentStatus;
  storagePath?: string | null;
  sizeBytes?: number | null;
}) {
  if (hasDirectDatabaseConfig()) {
    return createDocumentDirect({
      sessionId: input.sessionId,
      filename: input.filename,
      contentType: input.contentType,
      status: input.status ?? "processing",
      storagePath: input.storagePath ?? null,
      sizeBytes: input.sizeBytes ?? null,
    });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      session_id: input.sessionId,
      filename: input.filename,
      content_type: input.contentType,
      status: input.status ?? "processing",
      storage_path: input.storagePath ?? null,
      size_bytes: input.sizeBytes ?? null,
    })
    .select("id, session_id, filename, content_type, status, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create document record: ${error?.message ?? "Unknown error"}`);
  }

  return mapDocumentRow(data as DbDocumentRow);
}

export async function updateDocumentStatus(documentId: string, status: DocumentStatus) {
  if (hasDirectDatabaseConfig()) {
    return updateDocumentStatusDirect({ documentId, status });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("documents").update({ status }).eq("id", documentId);

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

export async function deleteDocumentsByFilenameAndStatus(
  filename: string,
  status: DocumentStatus,
  sessionId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("filename", filename)
    .eq("status", status)
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`Failed to delete documents for retry: ${error.message}`);
  }
}

export async function deleteDocumentById(documentId: string, sessionId: string) {
  if (hasDirectDatabaseConfig()) {
    return deleteDocumentDirect(documentId, sessionId);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

export async function deleteDocumentsBySessionId(sessionId: string) {
  if (hasDirectDatabaseConfig()) {
    return deleteDocumentsBySessionDirect(sessionId);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("documents").delete().eq("session_id", sessionId);

  if (error) {
    throw new Error(`Failed to clear session documents: ${error.message}`);
  }
}

export async function insertDocumentChunks(
  rows: Array<ChunkCandidate & { documentId: string; embedding: number[] }>,
) {
  if (hasDirectDatabaseConfig()) {
    const documentId = rows[0]?.documentId;

    if (!documentId) {
      return;
    }

    await replaceDocumentChunks({
      documentId,
      chunks: rows.map((row) => ({
        chunkIndex: row.chunkIndex,
        sectionTitle: row.sectionTitle,
        content: row.content,
        tokenCount: row.tokenCount,
        metadata: row.metadata,
        embedding: row.embedding,
      })),
    });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("document_chunks").insert(
    rows.map((row) => ({
      document_id: row.documentId,
      chunk_index: row.chunkIndex,
      section_title: row.sectionTitle,
      content: row.content,
      token_count: row.tokenCount,
      metadata_json: row.metadata,
      embedding: row.embedding,
    })),
  );

  if (error) {
    throw new Error(`Failed to insert document chunks: ${error.message}`);
  }
}

export async function createTicket(rawText: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({ raw_text: rawText })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create ticket: ${error?.message ?? "Unknown error"}`);
  }

  return data.id as string;
}

export async function createInvestigation(input: {
  ticketId: string;
  status: string;
  answerMarkdown: string;
  supportLevel: SupportLevel;
  mode?: InvestigationMode | null;
  reviewStatus?: ReviewStatus | null;
  reviewDecision?: ReviewDecision | null;
  routingReason?: string | null;
  accountId?: string | null;
  customerReplyJson?: StructuredClaimSet | null;
  internalDiagnosisJson?: StructuredClaimSetWithOpenQuestions | null;
}) {
  return createInvestigationDirect(input);
}

export async function insertInvestigationSources(
  rows: Array<{
    investigationId: string;
    documentChunkId: string;
    rank: number;
    score: number;
  }>,
) {
  return insertInvestigationSourcesDirect(rows);
}

export async function insertInvestigationToolCalls(
  rows: Array<{
    investigationId: string;
    toolName: ToolCallRecord["toolName"];
    input: Record<string, unknown>;
    output: unknown;
  }>,
) {
  return insertInvestigationToolCallsDirect(rows);
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
