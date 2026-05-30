import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  investigateTicket: vi.fn(),
  normalizeInvestigationRequest: vi.fn(),
  ensureSessionId: vi.fn(),
  recordPipelineEvent: vi.fn(),
  captureServerException: vi.fn(),
  createRequestLogger: vi.fn(),
}));

vi.mock("@/src/server/investigation/investigate", () => ({
  investigateTicket: mocks.investigateTicket,
}));

vi.mock("@/lib/investigation-request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/investigation-request")>();
  return { ...actual, normalizeInvestigationRequest: mocks.normalizeInvestigationRequest };
});

vi.mock("@/src/server/session", () => ({ ensureSessionId: mocks.ensureSessionId }));
vi.mock("@/src/server/db/pipelineEvents", () => ({ recordPipelineEvent: mocks.recordPipelineEvent }));
vi.mock("@/src/server/observability/sentry", () => ({
  captureServerException: mocks.captureServerException,
}));
vi.mock("@/src/server/observability/log", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import { POST } from "@/app/api/investigate/route";
import { InvestigationRequestError } from "@/lib/investigation-request";

function makeLogger() {
  return { requestId: "req-test-1", info: vi.fn(), error: vi.fn(), finish: vi.fn() };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/investigate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const successResult = {
  investigationId: "inv-1",
  ticketId: "ticket-1",
  mode: "docs_plus_tools" as const,
  reviewStatus: "ready" as const,
  supportLevel: "high" as const,
  docEvidence: [],
  toolEvidence: [],
  toolCalls: [],
  customerReply: { claims: [] },
  internalDiagnosis: { claims: [], openQuestions: [] },
  reviewDecision: { status: "ready", reasonCode: "none", action: "none" },
  answerMarkdown: "Answer.",
  routingReason: "matched",
  sources: [],
};

describe("POST /api/investigate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue(makeLogger());
    mocks.ensureSessionId.mockResolvedValue("session-1");
    mocks.recordPipelineEvent.mockResolvedValue(undefined);
    mocks.captureServerException.mockReturnValue(undefined);
  });

  it("returns 200 with investigation result on success", async () => {
    const body = { ticket: "User cannot export CSV.", executionMode: "draft_answer", ragEnabled: true };
    mocks.normalizeInvestigationRequest.mockReturnValue({
      ticket: body.ticket,
      executionMode: "draft_answer",
      ragEnabled: true,
      selectedAccountId: null,
      investigationContext: null,
    });
    mocks.investigateTicket.mockResolvedValue(successResult);

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.investigationId).toBe("inv-1");
    expect(response.headers.get("x-request-id")).toBe("req-test-1");
  });

  it("returns 400 when normalizeInvestigationRequest throws InvestigationRequestError", async () => {
    mocks.normalizeInvestigationRequest.mockImplementation(() => {
      throw new InvestigationRequestError("Paste a support ticket before investigating.");
    });

    const response = await POST(makeRequest({ ticket: "" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Paste a support ticket before investigating.");
    expect(mocks.captureServerException).not.toHaveBeenCalled();
  });

  it("returns 500 and captures exception when investigateTicket throws", async () => {
    mocks.normalizeInvestigationRequest.mockReturnValue({
      ticket: "Cannot log in.",
      executionMode: "draft_answer",
      ragEnabled: true,
      selectedAccountId: null,
      investigationContext: null,
    });
    mocks.investigateTicket.mockRejectedValue(new Error("Database timeout."));

    const response = await POST(makeRequest({ ticket: "Cannot log in." }));

    expect(response.status).toBe(500);
    expect(mocks.captureServerException).toHaveBeenCalled();
    const json = await response.json();
    expect(json.error).toBe("Database timeout.");
  });
});
