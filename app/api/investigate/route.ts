import { NextResponse } from "next/server";
import { investigateTicket } from "@/lib/investigate";
import { createRequestLogger } from "@/lib/log";
import { ensureSessionId } from "@/lib/session";

export async function POST(request: Request) {
  const logger = createRequestLogger("/api/investigate");

  try {
    const sessionId = await ensureSessionId();
    const body = (await request.json()) as {
      ticket?: string;
      ragEnabled?: boolean;
      selectedAccountId?: string | null;
      investigationContext?: string | null;
    };
    const ticket = body.ticket?.trim() ?? "";
    const selectedAccountId = body.selectedAccountId?.trim() || null;
    const investigationContext = body.investigationContext?.trim() || null;
    logger.info("investigate_received", {
      sessionId,
      ragEnabled: body.ragEnabled ?? true,
      ticketLength: ticket.length,
      selectedAccountId,
      investigationContextLength: investigationContext?.length ?? 0
    });

    if (!ticket) {
      logger.finish({ outcome: "validation_error_no_ticket" });
      const response = NextResponse.json({ error: "Paste a support ticket before investigating." }, { status: 400 });
      response.headers.set("x-request-id", logger.requestId);
      return response;
    }

    const result = await investigateTicket({
      ticket,
      ragEnabled: body.ragEnabled ?? true,
      sessionId,
      selectedAccountId,
      investigationContext
    });
    logger.finish({
      outcome: "success",
      mode: result.mode,
      reviewStatus: result.reviewStatus,
      supportLevel: result.supportLevel,
      insufficientSupport: result.insufficientSupport,
      evidenceCount: result.docEvidence.length,
      toolEvidenceCount: result.toolEvidence.length,
      citationCount: result.citations.length
    });
    const response = NextResponse.json(result);
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed.";
    logger.error("investigate_request_failed", { message });
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
