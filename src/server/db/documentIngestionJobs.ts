import type { PoolClient } from "pg";
import { withPgClient } from "@/src/server/db/client";

type DocumentIngestionJobRow = {
  id: string;
};

export async function createDocumentIngestionJob(input: {
  documentId: string;
  maxAttempts?: number;
}) {
  return withPgClient(async (client) => createDocumentIngestionJobWithClient(client, input));
}

export async function createDocumentIngestionJobWithClient(
  client: PoolClient,
  input: {
    documentId: string;
    maxAttempts?: number;
  },
) {
  const result = await client.query<DocumentIngestionJobRow>(
    `
      insert into document_ingestion_jobs (document_id, status, attempt_count, max_attempts)
      values ($1, 'queued', 0, $2)
      returning id
    `,
    [input.documentId, input.maxAttempts ?? 3],
  );

  return result.rows[0]?.id;
}

export async function markDocumentIngestionJobQueued(input: {
  ingestionJobId: string;
  queueJobId: string;
  maxAttempts: number;
}) {
  return withPgClient(async (client) => {
    await client.query(
      `
        update document_ingestion_jobs
        set queue_job_id = $2,
            status = 'queued',
            max_attempts = $3
        where id = $1
      `,
      [input.ingestionJobId, input.queueJobId, input.maxAttempts],
    );
  });
}

export async function markDocumentIngestionJobProcessing(input: {
  ingestionJobId: string;
  queueJobId?: string;
  attemptCount: number;
  maxAttempts: number;
  workerId: string;
}) {
  return withPgClient(async (client) => {
    await client.query(
      `
        update document_ingestion_jobs
        set status = 'processing',
            queue_job_id = coalesce($2, queue_job_id),
            attempt_count = $3,
            max_attempts = $4,
            worker_id = $5,
            locked_at = timezone('utc', now()),
            started_at = coalesce(started_at, timezone('utc', now()))
        where id = $1
      `,
      [
        input.ingestionJobId,
        input.queueJobId ?? null,
        input.attemptCount,
        input.maxAttempts,
        input.workerId,
      ],
    );
  });
}

export async function markDocumentIngestionJobCompleted(input: {
  ingestionJobId: string;
  queueJobId?: string;
  attemptCount: number;
  maxAttempts: number;
  workerId: string;
}) {
  return withPgClient(async (client) => {
    await client.query(
      `
        update document_ingestion_jobs
        set status = 'completed',
            queue_job_id = coalesce($2, queue_job_id),
            attempt_count = $3,
            max_attempts = $4,
            worker_id = $5,
            locked_at = null,
            completed_at = timezone('utc', now())
        where id = $1
      `,
      [
        input.ingestionJobId,
        input.queueJobId ?? null,
        input.attemptCount,
        input.maxAttempts,
        input.workerId,
      ],
    );
  });
}

export async function markDocumentIngestionJobFailure(input: {
  ingestionJobId: string;
  queueJobId?: string;
  attemptCount: number;
  maxAttempts: number;
  workerId?: string;
  finalAttempt: boolean;
  errorCode: string | null;
  errorMessageSafe: string;
}) {
  return withPgClient(async (client) => {
    await client.query(
      `
        update document_ingestion_jobs
        set status = $2,
            queue_job_id = coalesce($3, queue_job_id),
            attempt_count = $4,
            max_attempts = $5,
            worker_id = coalesce($6, worker_id),
            locked_at = null,
            last_error_code = $7,
            last_error_message_safe = $8,
            completed_at = case when $2 = 'failed' then timezone('utc', now()) else completed_at end
        where id = $1
      `,
      [
        input.ingestionJobId,
        input.finalAttempt ? "failed" : "queued",
        input.queueJobId ?? null,
        input.attemptCount,
        input.maxAttempts,
        input.workerId ?? null,
        input.errorCode,
        input.errorMessageSafe,
      ],
    );
  });
}
