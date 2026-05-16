import { NextResponse } from "next/server";
import { investigateTicket } from "@/src/server/investigation/investigate";
import {
  InvestigationRequestError,
  normalizeInvestigationRequest,
} from "@/lib/investigation-request";
import { createRequestLogger } from "@/src/server/observability/log";
import { ensureSessionId } from "@/src/server/session";
import { recordPipelineEvent } from "@/src/server/db/pipelineEvents";
import { captureServerException } from "@/src/server/observability/sentry";

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
      investigationContextLength: payload.investigationContext?.length ?? 0,
    });
    await recordPipelineEvent({
      eventType: "INVESTIGATION_STARTED",
      status: "started",
      entityType: "session",
      entityId: sessionId,
      sessionId,
      metadata: {
        executionMode: payload.executionMode,
        ragEnabled: payload.ragEnabled,
        ticketLength: payload.ticket.length,
        investigationContextLength: payload.investigationContext?.length ?? 0,
      },
    }).catch(() => undefined);

    const result = await investigateTicket({
      ticket: payload.ticket,
      executionMode: payload.executionMode,
      ragEnabled: payload.ragEnabled,
      sessionId,
      selectedAccountId: payload.selectedAccountId,
      investigationContext: payload.investigationContext,
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
        [...result.customerReply.claims, ...result.internalDiagnosis.claims].flatMap(
          (claim) => claim.citations,
        ),
      ).size,
    });
    await recordPipelineEvent({
      eventType: "ANSWER_GENERATED",
      status: "completed",
      entityType: "investigation",
      entityId: result.investigationId,
      sessionId,
      metadata: {
        mode: result.mode,
        reviewStatus: result.reviewStatus,
        supportLevel: result.supportLevel,
        evidenceCount: result.docEvidence.length,
        toolEvidenceCount: result.toolEvidence.length,
      },
    }).catch(() => undefined);
    const response = NextResponse.json(result);
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed.";
    const status = error instanceof InvestigationRequestError ? 400 : 500;
    if (status >= 500) {
      captureServerException(error, {
        tags: {
          route: "/api/investigate",
          requestId: logger.requestId,
        },
        extra: {
          status,
        },
      });
    }
    logger.error("investigate_request_failed", { message });
    logger.finish({ outcome: status === 400 ? "validation_error" : "request_error" });
    await recordPipelineEvent({
      eventType: "INVESTIGATION_FAILED",
      status: "failed",
      entityType: "request",
      entityId: logger.requestId,
      metadata: {
        status,
      },
      errorCode: status === 400 ? "INVESTIGATION_REQUEST_INVALID" : "INVESTIGATION_REQUEST_FAILED",
      errorMessageSafe:
        status === 400 ? "Investigation request was invalid" : "Investigation request failed",
    }).catch(() => undefined);
    const response = NextResponse.json(
      {
        error: message,
      },
      { status },
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
