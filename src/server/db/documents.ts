import type { PoolClient } from "pg";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import { withPgClient } from "@/src/server/db/client";

type DocumentRow = {
  id: string;
  session_id: string | null;
  filename: string;
  content_type: string | null;
  status: DocumentStatus;
  created_at: Date | string;
  storage_path: string | null;
  size_bytes: string | number | null;
  error_code: string | null;
  error_message_safe: string | null;
  processed_at: Date | string | null;
};

function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    filename: row.filename,
    contentType: row.content_type,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    errorCode: row.error_code,
    errorMessageSafe: row.error_message_safe,
    processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null
  };
}

const documentSelect = `
  id, session_id, filename, content_type, status, created_at,
  storage_path, size_bytes, error_code, error_message_safe, processed_at
`;

export async function createUploadedDocument(input: {
  sessionId: string;
  filename: string;
  contentType: string | null;
  storagePath: string;
  sizeBytes: number;
}) {
  return createDocumentDirect({
    ...input,
    status: "uploaded"
  });
}

export async function createDocumentDirect(input: {
  sessionId: string;
  filename: string;
  contentType: string | null;
  status: DocumentStatus;
  storagePath?: string | null;
  sizeBytes?: number | null;
}) {
  return withPgClient(async (client) => {
    const result = await client.query<DocumentRow>(
      `
        insert into documents (session_id, filename, content_type, status, storage_path, size_bytes)
        values ($1, $2, $3, $4, $5, $6)
        returning ${documentSelect}
      `,
      [
        input.sessionId,
        input.filename,
        input.contentType,
        input.status,
        input.storagePath ?? null,
        input.sizeBytes ?? null
      ]
    );

    return mapDocument(result.rows[0] as DocumentRow);
  });
}

export async function listDocumentsDirect(sessionId: string) {
  return withPgClient(async (client) => {
    const result = await client.query<DocumentRow>(
      `
        select ${documentSelect}
        from documents
        where session_id = $1
        order by created_at desc
      `,
      [sessionId]
    );

    return result.rows.map(mapDocument);
  });
}

export async function getDocumentCountDirect(sessionId: string) {
  return withPgClient(async (client) => {
    const result = await client.query<{ count: string }>("select count(*) from documents where session_id = $1", [
      sessionId
    ]);

    return Number(result.rows[0]?.count ?? 0);
  });
}

export async function getDocumentForIngestion(documentId: string) {
  return withPgClient(async (client) => getDocumentForIngestionWithClient(client, documentId));
}

export async function getDocumentForIngestionWithClient(client: PoolClient, documentId: string) {
  const result = await client.query<DocumentRow>(
    `
      select ${documentSelect}
      from documents
      where id = $1
      limit 1
    `,
    [documentId]
  );

  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

export async function updateDocumentStatusDirect(input: {
  documentId: string;
  status: DocumentStatus;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
}) {
  return withPgClient(async (client) => {
    await updateDocumentStatusWithClient(client, input);
  });
}

export async function updateDocumentStatusWithClient(
  client: PoolClient,
  input: {
    documentId: string;
    status: DocumentStatus;
    errorCode?: string | null;
    errorMessageSafe?: string | null;
  }
) {
  await client.query(
    `
      update documents
      set
        status = $2,
        error_code = $3,
        error_message_safe = $4,
        processed_at = case when $2 in ('ready', 'failed') then timezone('utc', now()) else processed_at end
      where id = $1
    `,
    [input.documentId, input.status, input.errorCode ?? null, input.errorMessageSafe ?? null]
  );
}

export async function deleteDocumentDirect(documentId: string, sessionId: string) {
  return withPgClient(async (client) => {
    await client.query("delete from documents where id = $1 and session_id = $2", [documentId, sessionId]);
  });
}

export async function deleteDocumentsBySessionDirect(sessionId: string) {
  return withPgClient(async (client) => {
    await client.query("delete from documents where session_id = $1", [sessionId]);
  });
}
