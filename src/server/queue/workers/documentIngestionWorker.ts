import { Worker } from "bullmq";
import { chunkParsedDocument } from "@/lib/chunk";
import { embedTexts } from "@/lib/embed";
import { createRequestLogger } from "@/lib/log";
import { parseUploadedBuffer } from "@/lib/parse";
import { replaceDocumentChunksWithClient } from "@/src/server/db/chunks";
import { withPgClient } from "@/src/server/db/client";
import {
  getDocumentForIngestionWithClient,
  updateDocumentStatusDirect,
  updateDocumentStatusWithClient
} from "@/src/server/db/documents";
import { recordPipelineEvent, sanitizeError } from "@/src/server/db/pipelineEvents";
import { captureServerException } from "@/src/server/observability/sentry";
import { getLocalObject } from "@/src/server/storage/localObjectStorage";
import { getRedisConnection } from "@/src/server/queue/client";
import type { DocumentIngestionJob } from "@/src/server/queue/jobs";
import { JOB_NAMES, QUEUE_NAMES } from "@/src/server/queue/names";

async function processDocumentIngestion(jobData: DocumentIngestionJob, jobId?: string) {
  const logger = createRequestLogger("document-ingestion-worker", {
    documentId: jobData.documentId,
    jobId
  });
  const startedAt = Date.now();

  await recordPipelineEvent({
    eventType: "DOCUMENT_INGESTION_STARTED",
    status: "started",
    entityType: "document",
    entityId: jobData.documentId,
    sessionId: jobData.sessionId,
    metadata: { jobId }
  });

  try {
    const result = await withPgClient(async (client) => {
      await client.query("begin");

      try {
        const document = await getDocumentForIngestionWithClient(client, jobData.documentId);

        if (!document) {
          throw new Error("Document not found for ingestion.");
        }

        if (document.status === "ready") {
          await client.query("commit");
          return { skipped: true, chunkCount: 0 };
        }

        if (!document.storagePath) {
          throw new Error("Document storage path is missing.");
        }

        await updateDocumentStatusWithClient(client, {
          documentId: jobData.documentId,
          status: "processing"
        });

        const buffer = await getLocalObject(document.storagePath);
        const parsed = await parseUploadedBuffer({
          buffer,
          filename: document.filename,
          contentType: document.contentType ?? "application/octet-stream"
        });

        await recordPipelineEvent({
          eventType: "DOCUMENT_PARSED",
          status: "completed",
          entityType: "document",
          entityId: jobData.documentId,
          sessionId: jobData.sessionId,
          metadata: {
            filename: document.filename,
            contentType: document.contentType,
            sizeBytes: document.sizeBytes
          }
        });

        const chunks = chunkParsedDocument(parsed);

        if (!chunks.length) {
          throw new Error("No retrievable chunks were created.");
        }

        await recordPipelineEvent({
          eventType: "DOCUMENT_CHUNKED",
          status: "completed",
          entityType: "document",
          entityId: jobData.documentId,
          sessionId: jobData.sessionId,
          metadata: { chunkCount: chunks.length }
        });

        const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

        if (embeddings.length !== chunks.length) {
          throw new Error("Embedding count did not match chunk count.");
        }

        await recordPipelineEvent({
          eventType: "EMBEDDINGS_CREATED",
          status: "completed",
          entityType: "document",
          entityId: jobData.documentId,
          sessionId: jobData.sessionId,
          metadata: { chunkCount: chunks.length }
        });

        await replaceDocumentChunksWithClient(client, {
          documentId: jobData.documentId,
          chunks: chunks.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index] as number[]
          }))
        });

        await updateDocumentStatusWithClient(client, {
          documentId: jobData.documentId,
          status: "ready"
        });

        await client.query("commit");
        return { skipped: false, chunkCount: chunks.length };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });

    await recordPipelineEvent({
      eventType: result.skipped ? "DOCUMENT_INGESTION_SKIPPED" : "DOCUMENT_READY",
      status: result.skipped ? "skipped" : "completed",
      entityType: "document",
      entityId: jobData.documentId,
      sessionId: jobData.sessionId,
      durationMs: Date.now() - startedAt,
      metadata: {
        chunkCount: result.chunkCount,
        jobId
      }
    });

    logger.info("document_ingestion_completed", {
      chunkCount: result.chunkCount,
      skipped: result.skipped,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    const safeError = sanitizeError(error);
    captureServerException(error, {
      tags: {
        route: "document-ingestion-worker",
        jobName: JOB_NAMES.documentIngestion,
        documentId: jobData.documentId,
        jobId: jobId ?? "unknown"
      },
      extra: {
        errorCode: safeError.errorCode,
        sessionId: jobData.sessionId ?? null
      }
    });

    await updateDocumentStatusDirect({
      documentId: jobData.documentId,
      status: "failed",
      errorCode: safeError.errorCode,
      errorMessageSafe: safeError.errorMessageSafe
    }).catch(() => undefined);

    await recordPipelineEvent({
      eventType: "DOCUMENT_INGESTION_FAILED",
      status: "failed",
      entityType: "document",
      entityId: jobData.documentId,
      sessionId: jobData.sessionId,
      durationMs: Date.now() - startedAt,
      metadata: { jobId },
      errorCode: safeError.errorCode,
      errorMessageSafe: safeError.errorMessageSafe
    }).catch(() => undefined);

    logger.error("document_ingestion_failed", {
      errorCode: safeError.errorCode,
      errorMessageSafe: safeError.errorMessageSafe,
      durationMs: Date.now() - startedAt
    });

    throw error;
  }
}

export function createDocumentIngestionWorker() {
  return new Worker<DocumentIngestionJob>(
    QUEUE_NAMES.documentIngestion,
    async (job) => {
      if (job.name !== JOB_NAMES.documentIngestion) {
        return;
      }

      await processDocumentIngestion(job.data, job.id);
    },
    {
      connection: getRedisConnection()
    }
  );
}
