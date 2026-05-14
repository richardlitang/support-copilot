import type { PoolClient } from "pg";
import type { ChunkCandidate, EvidenceChunk } from "@/lib/types";
import { toPgVector, withPgClient } from "@/src/server/db/client";

export async function replaceDocumentChunks(input: {
  documentId: string;
  chunks: Array<ChunkCandidate & { embedding: number[] }>;
}) {
  return withPgClient(async (client) => {
    await replaceDocumentChunksWithClient(client, input);
  });
}

export async function replaceDocumentChunksWithClient(
  client: PoolClient,
  input: {
    documentId: string;
    chunks: Array<ChunkCandidate & { embedding: number[] }>;
  }
) {
  await client.query("delete from document_chunks where document_id = $1", [input.documentId]);

  for (const chunk of input.chunks) {
    await client.query(
      `
        insert into document_chunks (
          document_id,
          chunk_index,
          section_title,
          content,
          token_count,
          metadata_json,
          embedding
        )
        values ($1, $2, $3, $4, $5, $6, $7::extensions.vector)
      `,
      [
        input.documentId,
        chunk.chunkIndex,
        chunk.sectionTitle,
        chunk.content,
        chunk.tokenCount,
        JSON.stringify(chunk.metadata),
        toPgVector(chunk.embedding)
      ]
    );
  }
}

export async function countDocumentChunks(documentId: string) {
  return withPgClient(async (client) => {
    const result = await client.query<{ count: string }>(
      "select count(*) from document_chunks where document_id = $1",
      [documentId]
    );

    return Number(result.rows[0]?.count ?? 0);
  });
}

export async function matchDocumentChunksDirect(input: {
  sessionId: string;
  queryEmbedding: number[];
  matchCount: number;
  matchThreshold: number;
}) {
  return withPgClient(async (client) => {
    const result = await client.query<{
      id: string;
      document_id: string;
      filename: string;
      section_title: string | null;
      content: string;
      score: number;
      chunk_index: number;
    }>(
      `
        select *
        from match_document_chunks($1::extensions.vector, $2, $3, $4)
      `,
      [toPgVector(input.queryEmbedding), input.matchCount, input.matchThreshold, input.sessionId]
    );

    return result.rows.map(
      (row, index): EvidenceChunk => ({
        id: row.id,
        documentId: row.document_id,
        filename: row.filename,
        sectionTitle: row.section_title,
        content: row.content,
        score: row.score,
        rank: index + 1,
        chunkIndex: row.chunk_index
      })
    );
  });
}

export async function matchLiteralDocumentChunksDirect(input: {
  sessionId: string;
  literals: string[];
  matchCount: number;
}) {
  return withPgClient(async (client) => {
    const rowsById = new Map<string, EvidenceChunk & { literalMatches: string[] }>();

    for (const literal of input.literals) {
      const result = await client.query<{
        id: string;
        document_id: string;
        filename: string;
        section_title: string | null;
        content: string;
        chunk_index: number;
      }>(
        `
          select
            document_chunks.id,
            document_chunks.document_id,
            documents.filename,
            document_chunks.section_title,
            document_chunks.content,
            document_chunks.chunk_index
          from document_chunks
          inner join documents on documents.id = document_chunks.document_id
          where documents.session_id = $1
            and documents.status = 'ready'
            and document_chunks.content ilike $2
          limit $3
        `,
        [input.sessionId, `%${literal}%`, input.matchCount]
      );

      for (const row of result.rows) {
        const existing = rowsById.get(row.id);

        if (existing) {
          existing.literalMatches = Array.from(new Set([...existing.literalMatches, literal]));
          continue;
        }

        rowsById.set(row.id, {
          id: row.id,
          documentId: row.document_id,
          filename: row.filename,
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

    return Array.from(rowsById.values()).slice(0, input.matchCount);
  });
}
