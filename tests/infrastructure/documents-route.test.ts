import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureSessionId: vi.fn(),
  listDocuments: vi.fn(),
  deleteDocumentById: vi.fn(),
  deleteDocumentsBySessionId: vi.fn(),
  ingestBundledSampleDocument: vi.fn(),
  includesBundledSampleDocument: vi.fn(),
  captureServerException: vi.fn(),
  createRequestLogger: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/src/server/session", () => ({ ensureSessionId: mocks.ensureSessionId }));
vi.mock("@/src/server/db/documentRecords", () => ({
  listDocumentsRecord: mocks.listDocuments,
  deleteDocumentByIdRecord: mocks.deleteDocumentById,
  deleteDocumentsBySessionIdRecord: mocks.deleteDocumentsBySessionId,
}));
vi.mock("@/src/server/ingestion/sampleDocument", () => ({
  ingestBundledSampleDocument: mocks.ingestBundledSampleDocument,
  includesBundledSampleDocument: mocks.includesBundledSampleDocument,
  SAMPLE_DOCUMENT_OPT_OUT_COOKIE: "sample_doc_opt_out",
}));
vi.mock("@/src/server/observability/sentry", () => ({
  captureServerException: mocks.captureServerException,
}));
vi.mock("@/src/server/observability/log", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { GET, DELETE } from "@/app/api/documents/route";

function makeLogger() {
  return { requestId: "req-test-1", info: vi.fn(), error: vi.fn(), finish: vi.fn() };
}

function makeCookieStore(optOut = false) {
  return {
    get: vi.fn().mockReturnValue(optOut ? { value: "true" } : undefined),
    set: vi.fn(),
  };
}

const fakeDoc = {
  id: "doc-1",
  sessionId: "session-1",
  filename: "guide.pdf",
  status: "ready",
  createdAt: "2026-04-15T00:00:00.000Z",
};

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue(makeLogger());
    mocks.ensureSessionId.mockResolvedValue("session-1");
    mocks.captureServerException.mockReturnValue(undefined);
  });

  it("returns 200 with existing documents", async () => {
    mocks.cookies.mockResolvedValue(makeCookieStore(true));
    mocks.listDocuments.mockResolvedValue([fakeDoc]);

    const response = await GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0].id).toBe("doc-1");
  });

  it("ingests sample document when list is empty and opt-out cookie is not set", async () => {
    mocks.cookies.mockResolvedValue(makeCookieStore(false));
    mocks.listDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([fakeDoc]);
    mocks.ingestBundledSampleDocument.mockResolvedValue(undefined);

    const response = await GET();

    expect(mocks.ingestBundledSampleDocument).toHaveBeenCalledWith("session-1");
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.documents).toHaveLength(1);
  });
});

describe("DELETE /api/documents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue(makeLogger());
    mocks.ensureSessionId.mockResolvedValue("session-1");
    mocks.captureServerException.mockReturnValue(undefined);
  });

  it("clears all documents and sets opt-out cookie when clearAll is true", async () => {
    const cookieStore = makeCookieStore();
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.deleteDocumentsBySessionId.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/documents", {
      method: "DELETE",
      body: JSON.stringify({ clearAll: true }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await DELETE(request);

    expect(mocks.deleteDocumentsBySessionId).toHaveBeenCalledWith("session-1");
    expect(cookieStore.set).toHaveBeenCalled();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.documents).toEqual([]);
  });

  it("deletes a single document by id", async () => {
    const cookieStore = makeCookieStore();
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.deleteDocumentById.mockResolvedValue(undefined);
    mocks.listDocuments.mockResolvedValue([]);
    mocks.includesBundledSampleDocument.mockReturnValue(false);

    const request = new Request("http://localhost/api/documents", {
      method: "DELETE",
      body: JSON.stringify({ documentId: "doc-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await DELETE(request);

    expect(mocks.deleteDocumentById).toHaveBeenCalledWith("doc-1", "session-1");
    expect(response.status).toBe(200);
  });

  it("returns 400 when documentId is missing and clearAll is not set", async () => {
    mocks.cookies.mockResolvedValue(makeCookieStore());

    const request = new Request("http://localhost/api/documents", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await DELETE(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("documentId is required");
  });
});
