import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withPgClient: vi.fn(),
  getDocumentForIngestionWithClient: vi.fn(),
  updateDocumentStatusWithClient: vi.fn(),
  updateDocumentStatusDirect: vi.fn(),
  replaceDocumentChunksWithClient: vi.fn(),
  getLocalObject: vi.fn(),
  parseUploadedBuffer: vi.fn(),
  chunkParsedDocument: vi.fn(),
  embedTexts: vi.fn(),
  markDocumentIngestionJobProcessing: vi.fn(),
  markDocumentIngestionJobCompleted: vi.fn(),
  markDocumentIngestionJobFailure: vi.fn(),
  recordPipelineEvent: vi.fn(),
  sanitizeError: vi.fn(),
  captureServerException: vi.fn(),
  createRequestLogger: vi.fn(),
}));

vi.mock("@/src/server/db/client", () => ({ withPgClient: mocks.withPgClient }));
vi.mock("@/src/server/db/documents", () => ({
  getDocumentForIngestionWithClient: mocks.getDocumentForIngestionWithClient,
  updateDocumentStatusWithClient: mocks.updateDocumentStatusWithClient,
  updateDocumentStatusDirect: mocks.updateDocumentStatusDirect,
}));
vi.mock("@/src/server/db/chunks", () => ({
  replaceDocumentChunksWithClient: mocks.replaceDocumentChunksWithClient,
}));
vi.mock("@/src/server/storage/localObjectStorage", () => ({
  getLocalObject: mocks.getLocalObject,
}));
vi.mock("@/src/server/ingestion/parse", () => ({
  parseUploadedBuffer: mocks.parseUploadedBuffer,
}));
vi.mock("@/lib/chunk", () => ({ chunkParsedDocument: mocks.chunkParsedDocument }));
vi.mock("@/src/server/ai/embed", () => ({ embedTexts: mocks.embedTexts }));
vi.mock("@/src/server/db/documentIngestionJobs", () => ({
  markDocumentIngestionJobProcessing: mocks.markDocumentIngestionJobProcessing,
  markDocumentIngestionJobCompleted: mocks.markDocumentIngestionJobCompleted,
  markDocumentIngestionJobFailure: mocks.markDocumentIngestionJobFailure,
}));
vi.mock("@/src/server/db/pipelineEvents", () => ({
  recordPipelineEvent: mocks.recordPipelineEvent,
  sanitizeError: mocks.sanitizeError,
}));
vi.mock("@/src/server/observability/sentry", () => ({
  captureServerException: mocks.captureServerException,
}));
vi.mock("@/src/server/observability/log", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));
vi.mock("@/src/server/queue/client", () => ({ getRedisConnection: vi.fn() }));
vi.mock("bullmq", () => ({ Worker: vi.fn() }));

import { processDocumentIngestion } from "@/src/server/queue/workers/documentIngestionWorker";

const jobData = {
  documentId: "doc-1",
  ingestionJobId: "job-1",
  sessionId: "session-1",
};

const meta = { queueJobId: "q-1", attemptCount: 1, maxAttempts: 3 };

function makeLogger() {
  return { requestId: "req-1", info: vi.fn(), error: vi.fn(), finish: vi.fn() };
}

function makePgClient() {
  return { query: vi.fn().mockResolvedValue({}) };
}

const pendingDoc = {
  id: "doc-1",
  status: "pending",
  storagePath: "/uploads/doc-1.pdf",
  filename: "guide.pdf",
  contentType: "application/pdf",
  sizeBytes: 2048,
};

describe("processDocumentIngestion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRequestLogger.mockReturnValue(makeLogger());
    mocks.markDocumentIngestionJobProcessing.mockResolvedValue(undefined);
    mocks.markDocumentIngestionJobCompleted.mockResolvedValue(undefined);
    mocks.markDocumentIngestionJobFailure.mockResolvedValue(undefined);
    mocks.recordPipelineEvent.mockResolvedValue(undefined);
    mocks.captureServerException.mockReturnValue(undefined);
    mocks.updateDocumentStatusDirect.mockResolvedValue(undefined);
  });

  it("processes document from pending to ready on the happy path", async () => {
    const client1 = makePgClient();
    const client2 = makePgClient();
    mocks.getDocumentForIngestionWithClient.mockResolvedValue(pendingDoc);
    mocks.updateDocumentStatusWithClient.mockResolvedValue(undefined);
    mocks.withPgClient
      .mockImplementationOnce(async (fn: (c: typeof client1) => Promise<unknown>) => fn(client1))
      .mockImplementationOnce(async (fn: (c: typeof client2) => Promise<unknown>) => fn(client2));

    const fileBuffer = Buffer.from("pdf-content");
    mocks.getLocalObject.mockResolvedValue(fileBuffer);
    mocks.parseUploadedBuffer.mockResolvedValue({ sections: [{ title: "Intro", text: "Hello." }] });
    const chunks = [{ content: "Hello.", sectionTitle: "Intro", chunkIndex: 0, tokenCount: 2, metadata: {} }];
    mocks.chunkParsedDocument.mockReturnValue(chunks);
    mocks.embedTexts.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mocks.replaceDocumentChunksWithClient.mockResolvedValue(undefined);

    await processDocumentIngestion(jobData, meta);

    expect(mocks.getLocalObject).toHaveBeenCalledWith(pendingDoc.storagePath);
    expect(mocks.embedTexts).toHaveBeenCalledWith(["Hello."]);
    expect(mocks.replaceDocumentChunksWithClient).toHaveBeenCalled();
    expect(mocks.updateDocumentStatusWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "ready" }),
    );
    expect(mocks.markDocumentIngestionJobCompleted).toHaveBeenCalled();
  });

  it("skips processing when document is already ready", async () => {
    const client = makePgClient();
    mocks.getDocumentForIngestionWithClient.mockResolvedValue({ ...pendingDoc, status: "ready" });
    mocks.withPgClient.mockImplementationOnce(
      async (fn: (c: typeof client) => Promise<unknown>) => fn(client),
    );

    await processDocumentIngestion(jobData, meta);

    expect(mocks.getLocalObject).not.toHaveBeenCalled();
    expect(mocks.markDocumentIngestionJobCompleted).toHaveBeenCalled();
  });

  it("throws and records failure when document has no storagePath", async () => {
    const client = makePgClient();
    mocks.getDocumentForIngestionWithClient.mockResolvedValue({ ...pendingDoc, storagePath: null });
    mocks.withPgClient.mockImplementationOnce(
      async (fn: (c: typeof client) => Promise<unknown>) => fn(client),
    );
    mocks.sanitizeError.mockReturnValue({
      errorCode: "MISSING_STORAGE_PATH",
      errorMessageSafe: "Document storage path is missing.",
    });

    await expect(processDocumentIngestion(jobData, meta)).rejects.toThrow(
      "Document storage path is missing.",
    );

    expect(mocks.markDocumentIngestionJobFailure).toHaveBeenCalled();
    expect(mocks.updateDocumentStatusDirect).toHaveBeenCalled();
  });
});
