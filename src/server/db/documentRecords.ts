import { hasDirectDatabaseConfig } from "@/lib/env";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import {
  createDocumentDirect,
  deleteDocumentDirect,
  deleteDocumentsBySessionDirect,
  getDocumentCountDirect,
  listDocumentsDirect,
  updateDocumentStatusDirect,
} from "@/src/server/db/documents";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

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

export async function listDocumentsRecord(sessionId: string) {
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

export async function getDocumentCountRecord(sessionId: string) {
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

export async function createDocumentRecordDirect(input: {
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

export async function updateDocumentRecordStatus(documentId: string, status: DocumentStatus) {
  if (hasDirectDatabaseConfig()) {
    return updateDocumentStatusDirect({ documentId, status });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("documents").update({ status }).eq("id", documentId);

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

export async function deleteDocumentsByFilenameAndStatusRecord(
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

export async function deleteDocumentByIdRecord(documentId: string, sessionId: string) {
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

export async function deleteDocumentsBySessionIdRecord(sessionId: string) {
  if (hasDirectDatabaseConfig()) {
    return deleteDocumentsBySessionDirect(sessionId);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("documents").delete().eq("session_id", sessionId);

  if (error) {
    throw new Error(`Failed to clear session documents: ${error.message}`);
  }
}
