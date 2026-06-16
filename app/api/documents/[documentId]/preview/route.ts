import { NextResponse } from "next/server";
import { getDocumentByIdForSessionRecord as getDocumentByIdForSession } from "@/src/server/db/documentRecords";
import { createRequestLogger } from "@/src/server/observability/log";
import { captureServerException } from "@/src/server/observability/sentry";
import { ensureSessionId } from "@/src/server/session";
import { getLocalObject } from "@/src/server/storage/localObjectStorage";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

function isPdfDocument(input: { filename: string; contentType: string | null }) {
  return input.contentType === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf");
}

function contentDispositionFilename(filename: string) {
  return filename.replace(/[\\"]/g, "_");
}

export async function GET(_request: Request, context: RouteContext) {
  const logger = createRequestLogger("/api/documents/[documentId]/preview:get");

  try {
    const sessionId = await ensureSessionId();
    const { documentId } = await context.params;
    const document = await getDocumentByIdForSession(documentId, sessionId);

    if (!document) {
      logger.finish({ outcome: "not_found", sessionId, documentId });
      const response = NextResponse.json({ error: "Document not found." }, { status: 404 });
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    if (!isPdfDocument(document)) {
      logger.finish({
        outcome: "unsupported_media_type",
        sessionId,
        documentId,
        contentType: document.contentType ?? "unknown",
      });
      const response = NextResponse.json(
        { error: "PDF preview is only available for uploaded PDF documents." },
        { status: 415 },
      );
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    if (!document.storagePath) {
      logger.finish({ outcome: "missing_storage_path", sessionId, documentId });
      const response = NextResponse.json(
        { error: "Document preview is unavailable for this file." },
        { status: 404 },
      );
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const buffer = await getLocalObject(document.storagePath);
    logger.finish({
      outcome: "success",
      sessionId,
      documentId,
      sizeBytes: buffer.byteLength,
    });

    return new Response(buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${contentDispositionFilename(document.filename)}"`,
        "cache-control": "private, no-store",
        "x-request-id": logger.requestId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview document.";
    captureServerException(error, {
      tags: {
        route: "/api/documents/[documentId]/preview:get",
        requestId: logger.requestId,
      },
    });
    logger.error("document_preview_failed", { message });
    logger.finish({ outcome: "request_error" });
    const response = NextResponse.json({ error: message }, { status: 500 });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
