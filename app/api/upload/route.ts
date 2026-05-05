import { NextResponse } from "next/server";
import { getDocumentCount, listDocuments } from "@/lib/db";
import { ingestParsedDocument } from "@/lib/ingest";
import { createRequestLogger } from "@/lib/log";
import { parseUploadedFile } from "@/lib/parse";
import { ensureSessionId } from "@/lib/session";
import type { UploadOutcome } from "@/lib/types";

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const logger = createRequestLogger("/api/upload");

  try {
    const sessionId = await ensureSessionId();
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    logger.info("upload_received", {
      sessionId,
      fileCount: files.length
    });

    if (!files.length) {
      logger.finish({ outcome: "validation_error_no_files" });
      const response = NextResponse.json({ error: "Upload at least one document." }, { status: 400 });
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
        maxFiles: MAX_FILES
      });
      const response = NextResponse.json(
        {
          error: `This session supports up to ${MAX_FILES} documents. Remove one before uploading more.`
        },
        { status: 400 }
      );
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const outcomes: UploadOutcome[] = [];

    for (const file of files) {
      logger.info("file_processing_started", {
        filename: file.name,
        contentType: file.type || "unknown",
        sizeBytes: file.size
      });

      if (file.size > MAX_FILE_SIZE_BYTES) {
        outcomes.push({
          filename: file.name,
          status: "failed",
          message: "File exceeds the 5 MB demo limit."
        });
        logger.info("file_rejected_size_limit", {
          filename: file.name,
          sizeBytes: file.size,
          maxSizeBytes: MAX_FILE_SIZE_BYTES
        });
        continue;
      }

      try {
        const parsed = await parseUploadedFile(file);
        const result = await ingestParsedDocument({
          parsedDocument: parsed,
          sessionId
        });
        outcomes.push({
          filename: file.name,
          status: "ready",
          message: `Ingested ${result.chunkCount} retrievable chunks.`
        });
        logger.info("file_ingested", {
          filename: file.name,
          chunkCount: result.chunkCount
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        outcomes.push({
          filename: file.name,
          status: "failed",
          message
        });
        logger.error("file_ingest_failed", {
          filename: file.name,
          message
        });
      }
    }

    const documents = await listDocuments(sessionId);
    const hasFailure = outcomes.some((item) => item.status === "failed");
    logger.finish({
      outcome: hasFailure ? "partial_success" : "success",
      documentCount: documents.length,
      failureCount: outcomes.filter((item) => item.status === "failed").length
    });
    const response = NextResponse.json(
      {
        documents,
        outcomes
      },
      { status: hasFailure ? 207 : 200 }
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    logger.error("upload_request_failed", { message });
    logger.finish({ outcome: "request_error" });
    const response = NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
