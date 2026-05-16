import { hasDirectDatabaseConfig } from "@/lib/env";
import type { EvidenceChunk } from "@/lib/types";
import {
  matchDocumentChunksDirect,
  matchLiteralDocumentChunksDirect,
} from "@/src/server/db/chunks";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

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

export async function matchDocumentChunksDb(input: {
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
    match_threshold: input.matchThreshold,
  });

  if (error) {
    throw new Error(`Failed to retrieve document chunks: ${error.message}`);
  }

  return (data ?? []).map(
    (row: MatchRow, index: number): EvidenceChunk => ({
      id: row.id,
      documentId: row.document_id,
      filename: row.filename,
      sectionTitle: row.section_title,
      content: row.content,
      score: row.score,
      rank: index + 1,
      chunkIndex: row.chunk_index,
    }),
  );
}

export async function matchLiteralDocumentChunksDb(input: {
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
        literalMatches: [literal],
      });
    }
  }

  for (const literal of input.literals) {
    const pattern = `%${literal}%`;
    const contentResult = await supabase
      .from("document_chunks")
      .select(
        "id, document_id, section_title, content, chunk_index, documents!inner(filename, session_id)",
      )
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
      .select(
        "id, document_id, section_title, content, chunk_index, documents!inner(filename, session_id)",
      )
      .eq("documents.session_id", input.sessionId)
      .eq("documents.status", "ready")
      .ilike("section_title", pattern)
      .limit(input.matchCount);

    if (titleResult.error) {
      throw new Error(
        `Failed to retrieve literal document chunks by title: ${titleResult.error.message}`,
      );
    }

    addRows((titleResult.data ?? []) as LiteralMatchRow[], literal);
  }

  return Array.from(rowsById.values())
    .slice(0, input.matchCount)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}
