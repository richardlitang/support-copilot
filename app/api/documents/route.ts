import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  deleteDocumentByIdRecord as deleteDocumentById,
  deleteDocumentsBySessionIdRecord as deleteDocumentsBySessionId,
  listDocumentsRecord as listDocuments,
} from "@/src/server/db/documentRecords";
import { createRequestLogger } from "@/src/server/observability/log";
import {
  ingestBundledSampleDocument,
  includesBundledSampleDocument,
  SAMPLE_DOCUMENT_OPT_OUT_COOKIE,
} from "@/src/server/ingestion/sampleDocument";
import { ensureSessionId } from "@/src/server/session";
import { captureServerException } from "@/src/server/observability/sentry";

export async function GET() {
  const logger = createRequestLogger("/api/documents:get");

  try {
    const sessionId = await ensureSessionId();
    const cookieStore = await cookies();
    let documents = await listDocuments(sessionId);

    if (!documents.length && cookieStore.get(SAMPLE_DOCUMENT_OPT_OUT_COOKIE)?.value !== "true") {
      try {
        await ingestBundledSampleDocument(sessionId);
        documents = await listDocuments(sessionId);
      } catch (sampleError) {
        captureServerException(sampleError, {
          tags: {
            route: "/api/documents:get",
            requestId: logger.requestId,
          },
          extra: {
            sessionId,
          },
        });
        logger.error("bundled_sample_ingest_failed", {
          message:
            sampleError instanceof Error
              ? sampleError.message
              : "Failed to ingest bundled sample document.",
        });
      }
    }

    logger.finish({
      outcome: "success",
      sessionId,
      documentCount: documents.length,
    });
    const response = NextResponse.json({ documents });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load documents.";
    captureServerException(error, {
      tags: {
        route: "/api/documents:get",
        requestId: logger.requestId,
      },
    });
    logger.error("documents_get_failed", { message });
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

export async function DELETE(request: Request) {
  const logger = createRequestLogger("/api/documents:delete");

  try {
    const sessionId = await ensureSessionId();
    const cookieStore = await cookies();
    const payload = (await request.json()) as { documentId?: string; clearAll?: boolean };
    if (payload.clearAll) {
      await deleteDocumentsBySessionId(sessionId);
      cookieStore.set(SAMPLE_DOCUMENT_OPT_OUT_COOKIE, "true", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
      logger.finish({
        outcome: "success_clear_all",
        sessionId,
      });
      const response = NextResponse.json({ documents: [] });
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const documentId = payload.documentId?.trim();

    if (!documentId) {
      logger.finish({ outcome: "validation_error_missing_document_id", sessionId });
      const response = NextResponse.json({ error: "documentId is required." }, { status: 400 });
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    await deleteDocumentById(documentId, sessionId);
    const documents = await listDocuments(sessionId);
    if (!includesBundledSampleDocument(documents)) {
      cookieStore.set(SAMPLE_DOCUMENT_OPT_OUT_COOKIE, "true", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
    }
    logger.finish({
      outcome: "success_delete_one",
      sessionId,
      documentId,
      documentCount: documents.length,
    });
    const response = NextResponse.json({ documents });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document.";
    captureServerException(error, {
      tags: {
        route: "/api/documents:delete",
        requestId: logger.requestId,
      },
    });
    logger.error("documents_delete_failed", { message });
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
