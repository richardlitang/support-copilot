import { NextResponse } from "next/server";
import { investigateTicket } from "@/lib/investigate";
import { InvestigationRequestError, normalizeInvestigationRequest } from "@/lib/investigation-request";
import { createRequestLogger } from "@/lib/log";
import { ensureSessionId } from "@/lib/session";

export async function POST(request: Request) {
  const logger = createRequestLogger("/api/investigate");

  try {
    const sessionId = await ensureSessionId();
    const body = await request.json();
    const payload = normalizeInvestigationRequest(body);
    logger.info("investigate_received", {
      sessionId,
      executionMode: payload.executionMode,
      ragEnabled: payload.ragEnabled,
      ticketLength: payload.ticket.length,
      selectedAccountId: payload.selectedAccountId,
      investigationContextLength: payload.investigationContext?.length ?? 0
    });

    const result = await investigateTicket({
      ticket: payload.ticket,
      executionMode: payload.executionMode,
      ragEnabled: payload.ragEnabled,
      sessionId,
      selectedAccountId: payload.selectedAccountId,
      investigationContext: payload.investigationContext
    });
    logger.finish({
      outcome: "success",
      mode: result.mode,
      reviewStatus: result.reviewStatus,
      supportLevel: result.supportLevel,
      insufficientSupport: result.supportLevel === "insufficient_support",
      evidenceCount: result.docEvidence.length,
      toolEvidenceCount: result.toolEvidence.length,
      citationCount: new Set(
        [...result.customerReply.claims, ...result.internalDiagnosis.claims].flatMap((claim) => claim.citations)
      ).size
    });
    const response = NextResponse.json(result);
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed.";
    const status = error instanceof InvestigationRequestError ? 400 : 500;
    logger.error("investigate_request_failed", { message });
    logger.finish({ outcome: status === 400 ? "validation_error" : "request_error" });
    const response = NextResponse.json(
      {
        error: message
      },
      { status }
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
