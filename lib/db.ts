import { createClient } from "@supabase/supabase-js";
import { ensureEnvLoaded, hasDirectDatabaseConfig } from "@/lib/env";
import {
  createDocumentDirect,
  deleteDocumentDirect,
  deleteDocumentsBySessionDirect,
  getDocumentCountDirect,
  listDocumentsDirect,
  updateDocumentStatusDirect
} from "@/src/server/db/documents";
import {
  matchDocumentChunksDirect,
  matchLiteralDocumentChunksDirect,
  replaceDocumentChunks
} from "@/src/server/db/chunks";
import { withPgClient } from "@/src/server/db/client";
import type {
  AccountRecord,
  ErrorEventRecord,
  FeatureFlagRecord,
  InvestigationMode,
  ReviewDecision,
  ReviewStatus,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord
} from "@/lib/types/investigation";
import type {
  ChunkCandidate,
  DocumentRecord,
  DocumentStatus,
  EvidenceChunk,
  SupportLevel
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

type MatchRow = {
  id: string;
  document_id: string;
  filename: string;
  section_title: string | null;
  content: string;
  score: number;
  chunk_index: number;
};

type LiteralMatchRow = {
  id: string;
  document_id: string;
  section_title: string | null;
  content: string;
  chunk_index: number;
  documents?: {
    filename?: string | null;
    session_id?: string | null;
  } | null;
};

type DbAccountRow = {
  id: string;
  name: string;
  plan_tier: string;
  status: string;
  enabled_modules_json: unknown;
  limits_json: unknown;
  created_at: string;
};

type DbFeatureFlagRow = {
  id: string;
  account_id: string;
  flag_key: string;
  flag_value: boolean;
  description: string | null;
  rollout_notes: string | null;
  created_at: string;
};

type DbErrorEventRow = {
  id: string;
  account_id: string;
  product_area: string | null;
  error_code: string;
  summary: string;
  occurred_at: string;
  created_at: string;
};

type InvestigationJsonPayload = StructuredClaimSet | StructuredClaimSetWithOpenQuestions;

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
      ...(data ?? {})
    })
  );
}

function isSchemaCompatibilityError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relation")
  );
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getSupabaseUrl() {
  ensureEnvLoaded();
  const rawUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^"(.*)"$/, "$1");

  if (!rawUrl) {
    return "";
  }

  if (rawUrl.startsWith("postgresql://") || rawUrl.startsWith("postgres://")) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname;
      const projectRef = host.startsWith("db.") ? host.slice(3).split(".")[0] : "";

      if (projectRef) {
        return `https://${projectRef}.supabase.co`;
      }
    } catch {
      return "";
    }
  }

  return rawUrl;
}

function getSupabaseServiceKey() {
  ensureEnvLoaded();
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function hasDatabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export function getSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

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
    processedAt: row.processed_at ?? null
  };
}

function mapAccountRow(row: DbAccountRow): AccountRecord {
  return {
    id: row.id,
    name: row.name,
    planTier: row.plan_tier,
    status: row.status,
    enabledModules: readStringArray(row.enabled_modules_json),
    limits: readRecord(row.limits_json),
    createdAt: row.created_at
  };
}

function mapFeatureFlagRow(row: DbFeatureFlagRow): FeatureFlagRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    flagKey: row.flag_key,
    flagValue: row.flag_value,
    description: row.description,
    rolloutNotes: row.rollout_notes,
    createdAt: row.created_at
  };
}

function mapErrorEventRow(row: DbErrorEventRow): ErrorEventRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    productArea: row.product_area,
    errorCode: row.error_code,
    summary: row.summary,
    occurredAt: row.occurred_at,
    createdAt: row.created_at
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
      hasSessionId: Boolean(sessionId)
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const documents = await listDocuments(sessionId);
    emitPerf("listDocumentsSafe_completed", {
      sessionId,
      documentCount: documents.length,
      durationMs: Date.now() - startedAt
    });
    return documents;
  } catch (error) {
    emitPerf("listDocumentsSafe_failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error"
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
      sizeBytes: input.sizeBytes ?? null
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
      size_bytes: input.sizeBytes ?? null
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

export async function deleteDocumentsByFilenameAndStatus(filename: string, status: DocumentStatus, sessionId: string) {
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
  const { error } = await supabase.from("documents").delete().eq("id", documentId).eq("session_id", sessionId);

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
  rows: Array<ChunkCandidate & { documentId: string; embedding: number[] }>
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
        embedding: row.embedding
      }))
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
      embedding: row.embedding
    }))
  );

  if (error) {
    throw new Error(`Failed to insert document chunks: ${error.message}`);
  }
}

export async function createTicket(rawText: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("tickets").insert({ raw_text: rawText }).select("id").single();

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
  const supabase = getSupabaseAdminClient();
  const primaryInsert = await supabase
    .from("investigations")
    .insert({
      ticket_id: input.ticketId,
      status: input.status,
      answer_markdown: input.answerMarkdown,
      support_level: input.supportLevel,
      mode: input.mode ?? null,
      review_status: input.reviewStatus ?? null,
      review_reason_code: input.reviewDecision?.reasonCode ?? null,
      review_action: input.reviewDecision?.action ?? null,
      routing_reason: input.routingReason ?? null,
      account_id: input.accountId ?? null,
      customer_reply_json: (input.customerReplyJson ?? null) as InvestigationJsonPayload | null,
      internal_diagnosis_json: (input.internalDiagnosisJson ?? null) as InvestigationJsonPayload | null
    })
    .select("id")
    .single();

  if (!primaryInsert.error && primaryInsert.data) {
    return primaryInsert.data.id as string;
  }

  if (isSchemaCompatibilityError(primaryInsert.error.message)) {
    throw new Error(
      `Failed to create investigation: ${primaryInsert.error.message}. Apply the structured investigation schema migration before running investigations.`
    );
  }

  throw new Error(`Failed to create investigation: ${primaryInsert.error.message}`);
}

export async function insertInvestigationSources(
  rows: Array<{
    investigationId: string;
    documentChunkId: string;
    rank: number;
    score: number;
  }>
) {
  if (!rows.length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("investigation_sources").insert(
    rows.map((row) => ({
      investigation_id: row.investigationId,
      document_chunk_id: row.documentChunkId,
      rank: row.rank,
      score: row.score
    }))
  );

  if (error) {
    throw new Error(`Failed to save investigation sources: ${error.message}`);
  }
}

export async function insertInvestigationToolCalls(
  rows: Array<{
    investigationId: string;
    toolName: ToolCallRecord["toolName"];
    input: Record<string, unknown>;
    output: unknown;
  }>
) {
  if (!rows.length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("investigation_tool_calls").insert(
    rows.map((row) => ({
      investigation_id: row.investigationId,
      tool_name: row.toolName,
      tool_input_json: row.input,
      tool_output_json: row.output
    }))
  );

  if (error) {
    throw new Error(`Failed to save investigation tool calls: ${error.message}`);
  }
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
  if (hasDirectDatabaseConfig()) {
    return withPgClient(async (client) => {
      const result = await client.query<{ ticket_id: string; investigation_id: string }>(
        `
          select *
          from create_investigation_run(
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,
            $14::jsonb
          )
        `,
        [
          input.ticketText,
          input.status,
          input.answerMarkdown,
          input.supportLevel,
          input.mode,
          input.reviewStatus,
          input.reviewDecision.reasonCode,
          input.reviewDecision.action,
          input.routingReason,
          input.accountId ?? null,
          JSON.stringify(input.customerReplyJson),
          JSON.stringify(input.internalDiagnosisJson),
          JSON.stringify(
            input.sources.map((source) => ({
              document_chunk_id: source.documentChunkId,
              rank: source.rank,
              score: source.score
            }))
          ),
          JSON.stringify(
            input.toolCalls.map((toolCall) => ({
              tool_name: toolCall.toolName,
              tool_input_json: toolCall.input,
              tool_output_json: toolCall.output
            }))
          )
        ]
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Failed to persist investigation run: no row returned.");
      }

      return {
        ticketId: row.ticket_id,
        investigationId: row.investigation_id
      };
    });
  }

  const supabase = getSupabaseAdminClient();
  const rpcResult = await supabase
    .rpc("create_investigation_run", {
      p_ticket_text: input.ticketText,
      p_status: input.status,
      p_answer_markdown: input.answerMarkdown,
      p_support_level: input.supportLevel,
      p_mode: input.mode,
      p_review_status: input.reviewStatus,
      p_review_reason_code: input.reviewDecision.reasonCode,
      p_review_action: input.reviewDecision.action,
      p_routing_reason: input.routingReason,
      p_account_id: input.accountId ?? null,
      p_customer_reply_json: input.customerReplyJson as InvestigationJsonPayload,
      p_internal_diagnosis_json: input.internalDiagnosisJson as InvestigationJsonPayload,
      p_sources: input.sources.map((source) => ({
        document_chunk_id: source.documentChunkId,
        rank: source.rank,
        score: source.score
      })),
      p_tool_calls: input.toolCalls.map((toolCall) => ({
        tool_name: toolCall.toolName,
        tool_input_json: toolCall.input,
        tool_output_json: toolCall.output
      }))
    })
    .single();

  if (!rpcResult.error && rpcResult.data) {
    const data = rpcResult.data as { ticket_id: string; investigation_id: string };

    return {
      ticketId: data.ticket_id,
      investigationId: data.investigation_id
    };
  }

  const errorMessage = rpcResult.error?.message ?? "Unknown error";

  if (
    !rpcResult.error ||
    (!errorMessage.includes("create_investigation_run") && !errorMessage.toLowerCase().includes("schema cache"))
  ) {
    throw new Error(`Failed to persist investigation run: ${errorMessage}`);
  }

  throw new Error(`Failed to persist investigation run: ${errorMessage}. Apply the atomic investigation-run migration.`);
}

export async function matchDocumentChunks(input: {
  sessionId: string;
  queryEmbedding: number[];
  matchCount: number;
  matchThreshold: number;
}): Promise<EvidenceChunk[]> {
  if (hasDirectDatabaseConfig()) {
    return matchDocumentChunksDirect(input);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_document_chunks", {
    session_id_filter: input.sessionId,
    query_embedding: input.queryEmbedding,
    match_count: input.matchCount,
    match_threshold: input.matchThreshold
  });

  if (error) {
    throw new Error(`Failed to retrieve document chunks: ${error.message}`);
  }

  return (data ?? []).map((row: MatchRow, index: number): EvidenceChunk => ({
    id: row.id,
    documentId: row.document_id,
    filename: row.filename,
    sectionTitle: row.section_title,
    content: row.content,
    score: row.score,
    rank: index + 1,
    chunkIndex: row.chunk_index
  }));
}

export async function matchLiteralDocumentChunks(input: {
  sessionId: string;
  literals: string[];
  matchCount: number;
}): Promise<EvidenceChunk[]> {
  if (hasDirectDatabaseConfig()) {
    return matchLiteralDocumentChunksDirect(input);
  }

  const supabase = getSupabaseAdminClient();
  const rowsById = new Map<string, EvidenceChunk & { literalMatches: string[] }>();

  function addRows(rows: LiteralMatchRow[], literal: string) {
    for (const row of rows) {
      const existing = rowsById.get(row.id);

      if (existing) {
        existing.literalMatches = Array.from(new Set([...existing.literalMatches, literal]));
        continue;
      }

      rowsById.set(row.id, {
        id: row.id,
        documentId: row.document_id,
        filename: row.documents?.filename ?? "Untitled document",
        sectionTitle: row.section_title,
        content: row.content,
        score: 0.62,
        rank: rowsById.size + 1,
        chunkIndex: row.chunk_index,
        retrievalSource: "literal",
        literalMatches: [literal]
      });
    }
  }

  for (const literal of input.literals) {
    const pattern = `%${literal}%`;
    const contentResult = await supabase
      .from("document_chunks")
      .select("id, document_id, section_title, content, chunk_index, documents!inner(filename, session_id)")
      .eq("documents.session_id", input.sessionId)
      .eq("documents.status", "ready")
      .ilike("content", pattern)
      .limit(input.matchCount);

    if (contentResult.error) {
      throw new Error(`Failed to retrieve literal document chunks: ${contentResult.error.message}`);
    }

    addRows((contentResult.data ?? []) as LiteralMatchRow[], literal);

    const titleResult = await supabase
      .from("document_chunks")
      .select("id, document_id, section_title, content, chunk_index, documents!inner(filename, session_id)")
      .eq("documents.session_id", input.sessionId)
      .eq("documents.status", "ready")
      .ilike("section_title", pattern)
      .limit(input.matchCount);

    if (titleResult.error) {
      throw new Error(`Failed to retrieve literal document chunks by title: ${titleResult.error.message}`);
    }

    addRows((titleResult.data ?? []) as LiteralMatchRow[], literal);
  }

  return Array.from(rowsById.values()).slice(0, input.matchCount).map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}

export async function listAccounts() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, plan_tier, status, enabled_modules_json, limits_json, created_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list accounts: ${error.message}`);
  }

  return (data ?? []).map((row) => mapAccountRow(row as DbAccountRow));
}

export async function listAccountsSafe() {
  if (!hasDatabaseConfig()) {
    emitPerf("listAccountsSafe_skipped", {
      hasDatabaseConfig: false
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const accounts = await listAccounts();
    emitPerf("listAccountsSafe_completed", {
      accountCount: accounts.length,
      durationMs: Date.now() - startedAt
    });
    return accounts;
  } catch (error) {
    emitPerf("listAccountsSafe_failed", {
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return [];
  }
}

export async function getAccountById(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, plan_tier, status, enabled_modules_json, limits_json, created_at")
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data ? mapAccountRow(data as DbAccountRow) : null;
}

export async function listFeatureFlagsByAccountId(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("id, account_id, flag_key, flag_value, description, rollout_notes, created_at")
    .eq("account_id", accountId)
    .order("flag_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load feature flags: ${error.message}`);
  }

  return (data ?? []).map((row) => mapFeatureFlagRow(row as DbFeatureFlagRow));
}

export async function listRecentErrorsByAccountId(input: {
  accountId: string;
  productArea?: string | null;
  limit?: number;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("error_events")
    .select("id, account_id, product_area, error_code, summary, occurred_at, created_at")
    .eq("account_id", input.accountId)
    .order("occurred_at", { ascending: false })
    .limit(input.limit ?? 5);

  if (input.productArea) {
    query = query.eq("product_area", input.productArea);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load recent errors: ${error.message}`);
  }

  return (data ?? []).map((row) => mapErrorEventRow(row as DbErrorEventRow));
}
