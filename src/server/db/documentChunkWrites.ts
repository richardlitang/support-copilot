import { hasDirectDatabaseConfig } from "@/src/server/config/env";
import type { ChunkCandidate } from "@/lib/types";
import { replaceDocumentChunks } from "@/src/server/db/chunks";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

export async function insertDocumentChunksRecord(
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
