import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureSessionId: vi.fn(),
  getDocumentByIdForSession: vi.fn(),
  getLocalObject: vi.fn(),
  captureServerException: vi.fn(),
  createRequestLogger: vi.fn(),
}));

vi.mock("@/src/server/session", () => ({ ensureSessionId: mocks.ensureSessionId }));
vi.mock("@/src/server/db/documentRecords", () => ({
  getDocumentByIdForSessionRecord: mocks.getDocumentByIdForSession,
}));
vi.mock("@/src/server/storage/localObjectStorage", () => ({
  getLocalObject: mocks.getLocalObject,
}));
vi.mock("@/src/server/observability/sentry", () => ({
  captureServerException: mocks.captureServerException,
}));
vi.mock("@/src/server/observability/log", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import { GET } from "@/app/api/documents/[documentId]/preview/route";

function makeLogger() {
  return { requestId: "req-test-1", info: vi.fn(), error: vi.fn(), finish: vi.fn() };
}

function makeRequest(documentId = "doc-1") {
  return new Request(`http://localhost/api/documents/${documentId}/preview`);
}

function makeParams(documentId = "doc-1") {
  return { params: Promise.resolve({ documentId }) };
}

const pdfDocument = {
  id: "doc-1",
  sessionId: "session-1",
  filename: "guide.pdf",
  contentType: "application/pdf",
  status: "ready",
  createdAt: "2026-04-15T00:00:00.000Z",
  storagePath: "doc-1/original.pdf",
};

describe("GET /api/documents/[documentId]/preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue(makeLogger());
    mocks.ensureSessionId.mockResolvedValue("session-1");
    mocks.captureServerException.mockReturnValue(undefined);
  });

  it("returns the stored PDF inline when it belongs to the current session", async () => {
    mocks.getDocumentByIdForSession.mockResolvedValue(pdfDocument);
    mocks.getLocalObject.mockResolvedValue(Buffer.from("%PDF-1.7 test"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(mocks.getDocumentByIdForSession).toHaveBeenCalledWith("doc-1", "session-1");
    expect(mocks.getLocalObject).toHaveBeenCalledWith("doc-1/original.pdf");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="guide.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("%PDF-1.7 test");
  });

  it("returns 404 when the document is not in the current session", async () => {
    mocks.getDocumentByIdForSession.mockResolvedValue(null);

    const response = await GET(makeRequest("other-doc"), makeParams("other-doc"));

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toContain("Document not found");
    expect(mocks.getLocalObject).not.toHaveBeenCalled();
  });

  it("returns 415 when the session document is not a PDF", async () => {
    mocks.getDocumentByIdForSession.mockResolvedValue({
      ...pdfDocument,
      filename: "guide.txt",
      contentType: "text/plain",
      storagePath: "doc-1/original.txt",
    });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(415);
    const json = await response.json();
    expect(json.error).toContain("PDF preview");
    expect(mocks.getLocalObject).not.toHaveBeenCalled();
  });
});
