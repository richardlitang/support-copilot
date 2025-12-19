import { NextResponse } from "next/server";
import { deleteDocumentById, deleteDocumentsBySessionId, listDocuments } from "@/lib/db";
import { createRequestLogger } from "@/lib/log";
import { ensureSessionId } from "@/lib/session";

export async function GET() {
  const logger = createRequestLogger("/api/documents:get");

  try {
    const sessionId = await ensureSessionId();
    const documents = await listDocuments(sessionId);
    logger.finish({
      outcome: "success",
      sessionId,
      documentCount: documents.length
    });
    const response = NextResponse.json({ documents });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load documents.";
    logger.error("documents_get_failed", { message });
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

export async function DELETE(request: Request) {
  const logger = createRequestLogger("/api/documents:delete");

  try {
    const sessionId = await ensureSessionId();
    const payload = (await request.json()) as { documentId?: string; clearAll?: boolean };
    if (payload.clearAll) {
      await deleteDocumentsBySessionId(sessionId);
      logger.finish({
        outcome: "success_clear_all",
        sessionId
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
    logger.finish({
      outcome: "success_delete_one",
      sessionId,
      documentId,
      documentCount: documents.length
    });
    const response = NextResponse.json({ documents });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document.";
    logger.error("documents_delete_failed", { message });
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
