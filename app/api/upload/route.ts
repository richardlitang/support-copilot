import { NextResponse } from "next/server";
import { getDocumentCount, listDocuments, createDocumentRecord } from "@/src/server/db";
import { getRuntimeConfig } from "@/src/server/config/env";
import { createRequestLogger } from "@/src/server/observability/log";
import { ensureSessionId } from "@/src/server/session";
import type { UploadOutcome } from "@/lib/types";
import { recordPipelineEvent } from "@/src/server/db/pipelineEvents";
import {
  createDocumentIngestionJob,
  markDocumentIngestionJobFailure,
  markDocumentIngestionJobQueued,
} from "@/src/server/db/documentIngestionJobs";
import { captureServerException } from "@/src/server/observability/sentry";
import { enqueueDocumentIngestionJob } from "@/src/server/queue/client";
import { putLocalObject } from "@/src/server/storage/localObjectStorage";

const MAX_FILES = 10;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const logger = createRequestLogger("/api/upload");

  try {
    const sessionId = await ensureSessionId();
    const config = getRuntimeConfig();
    const maxFileSizeBytes = config.maxUploadMb * 1024 * 1024;
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    logger.info("upload_received", {
      sessionId,
      fileCount: files.length,
    });

    if (!files.length) {
      logger.finish({ outcome: "validation_error_no_files" });
      const response = NextResponse.json(
        { error: "Upload at least one document." },
        { status: 400 },
      );
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const currentCount = await getDocumentCount(sessionId);
    logger.info("session_doc_count", { currentCount });

    if (currentCount + files.length > MAX_FILES) {
      logger.finish({
        outcome: "validation_error_session_limit",
        currentCount,
        incomingCount: files.length,
        maxFiles: MAX_FILES,
      });
      const response = NextResponse.json(
        {
          error: `This session supports up to ${MAX_FILES} documents. Remove one before uploading more.`,
        },
        { status: 400 },
      );
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const outcomes: UploadOutcome[] = [];

    for (const file of files) {
      logger.info("file_processing_started", {
        filename: file.name,
        contentType: file.type || "unknown",
        sizeBytes: file.size,
      });

      if (file.size > maxFileSizeBytes) {
        outcomes.push({
          filename: file.name,
          status: "failed",
          message: `File exceeds the ${config.maxUploadMb} MB upload limit.`,
        });
        logger.info("file_rejected_size_limit", {
          filename: file.name,
          sizeBytes: file.size,
          maxSizeBytes: maxFileSizeBytes,
        });
        continue;
      }

      let ingestionJobId: string | null = null;
      let documentId: string | null = null;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        if (buffer.byteLength > maxFileSizeBytes) {
          outcomes.push({
            filename: file.name,
            status: "failed",
            message: `File exceeds the ${config.maxUploadMb} MB upload limit.`,
          });
          logger.info("file_rejected_size_limit", {
            filename: file.name,
            reportedBytes: file.size,
            actualBytes: buffer.byteLength,
            maxSizeBytes: maxFileSizeBytes,
          });
          continue;
        }

        const stored = await putLocalObject({
          buffer,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });
        const document = await createDocumentRecord({
          sessionId,
          filename: file.name,
          contentType: file.type || null,
          status: "uploaded",
          storagePath: stored.storagePath,
          sizeBytes: file.size,
        });
        documentId = document.id;
        ingestionJobId = await createDocumentIngestionJob({
          documentId: document.id,
          maxAttempts: 3,
        });

        await recordPipelineEvent({
          eventType: "DOCUMENT_UPLOADED",
          status: "completed",
          entityType: "document",
          entityId: document.id,
          sessionId,
          metadata: {
            filename: file.name,
            contentType: file.type || "unknown",
            sizeBytes: file.size,
          },
        }).catch(() => undefined);

        const job = await enqueueDocumentIngestionJob({
          documentId: document.id,
          ingestionJobId: ingestionJobId,
          sessionId,
        });
        await markDocumentIngestionJobQueued({
          ingestionJobId,
          queueJobId: String(job.id),
          maxAttempts: 3,
        });

        await recordPipelineEvent({
          eventType: "DOCUMENT_INGESTION_ENQUEUED",
          status: "completed",
          entityType: "document",
          entityId: document.id,
          sessionId,
          metadata: {
            jobId: job.id,
            ingestionJobId,
            queueName: "document-ingestion",
          },
        }).catch(() => undefined);

        outcomes.push({
          filename: file.name,
          documentId: document.id,
          status: "uploaded",
          message: "Document accepted for background processing.",
        });
        logger.info("file_accepted", {
          filename: file.name,
          documentId: document.id,
          ingestionJobId,
          jobId: job.id,
          sizeBytes: file.size,
        });
      } catch (error) {
        captureServerException(error, {
          tags: {
            route: "/api/upload",
            requestId: logger.requestId,
          },
          extra: {
            filename: file.name,
            contentType: file.type || "unknown",
            sizeBytes: file.size,
          },
        });
        outcomes.push({
          filename: file.name,
          status: "failed",
          message: "Upload failed before ingestion could start.",
        });
        const errorMessage = error instanceof Error ? error.message : "Upload failed.";
        if (ingestionJobId) {
          await markDocumentIngestionJobFailure({
            ingestionJobId,
            attemptCount: 1,
            maxAttempts: 3,
            finalAttempt: true,
            errorCode: "INGESTION_ENQUEUE_FAILED",
            errorMessageSafe: "Document ingestion could not be enqueued.",
          }).catch(() => undefined);
        }
        if (documentId) {
          await recordPipelineEvent({
            eventType: "DOCUMENT_INGESTION_FAILED",
            status: "failed",
            entityType: "document",
            entityId: documentId,
            sessionId,
            errorCode: "INGESTION_ENQUEUE_FAILED",
            errorMessageSafe: "Document ingestion could not be enqueued.",
          }).catch(() => undefined);
        }
        const match = errorMessage.match(
          /duplicate key value violates unique constraint "document_ingestion_jobs_queue_job_id_key"/i,
        );
        if (match) {
          logger.error("ingestion_job_queue_id_conflict", { filename: file.name, errorMessage });
        }
        logger.error("file_ingest_failed", {
          filename: file.name,
          message: errorMessage,
        });
      }
    }

    const documents = await listDocuments(sessionId);
    const hasFailure = outcomes.some((item) => item.status === "failed");
    logger.finish({
      outcome: hasFailure ? "partial_success" : "success",
      documentCount: documents.length,
      failureCount: outcomes.filter((item) => item.status === "failed").length,
    });
    const response = NextResponse.json(
      {
        documents,
        outcomes,
      },
      { status: hasFailure ? 207 : 202 },
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    captureServerException(error, {
      tags: {
        route: "/api/upload",
        requestId: logger.requestId,
      },
    });
    logger.error("upload_request_failed", { message });
    logger.finish({ outcome: "request_error" });
    const response = NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
