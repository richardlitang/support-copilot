import { chunkParsedDocument as chunkParsedDocumentAdapter } from "@/lib/chunk";
import {
  createDocumentRecord as createDocumentRecordAdapter,
  insertDocumentChunks as insertDocumentChunksAdapter,
  updateDocumentStatus as updateDocumentStatusAdapter,
} from "@/src/server/db";
import { embedTexts as embedTextsAdapter } from "@/src/server/ai/embed";
import type { ParsedDocument } from "@/lib/types";

type IngestDependencies = {
  chunkParsedDocument: typeof chunkParsedDocumentAdapter;
  createDocumentRecord: typeof createDocumentRecordAdapter;
  insertDocumentChunks: typeof insertDocumentChunksAdapter;
  updateDocumentStatus: typeof updateDocumentStatusAdapter;
  embedTexts: typeof embedTextsAdapter;
};

const defaultDependencies: IngestDependencies = {
  chunkParsedDocument: chunkParsedDocumentAdapter,
  createDocumentRecord: createDocumentRecordAdapter,
  insertDocumentChunks: insertDocumentChunksAdapter,
  updateDocumentStatus: updateDocumentStatusAdapter,
  embedTexts: embedTextsAdapter,
};

export async function directIngestParsedDocument(
  input: {
    parsedDocument: ParsedDocument;
    sessionId: string;
  },
  dependencies: Partial<IngestDependencies> = {},
) {
  const deps = {
    ...defaultDependencies,
    ...dependencies,
  };

  const document = await deps.createDocumentRecord({
    sessionId: input.sessionId,
    filename: input.parsedDocument.filename,
    contentType: input.parsedDocument.contentType,
    status: "processing",
  });

  try {
    const chunks = deps.chunkParsedDocument(input.parsedDocument);

    if (!chunks.length) {
      throw new Error(`No retrievable chunks were created for ${input.parsedDocument.filename}.`);
    }

    const embeddings = await deps.embedTexts(chunks.map((chunk) => chunk.content));

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding count did not match chunk count.");
    }

    await deps.insertDocumentChunks(
      chunks.map((chunk, index) => ({
        ...chunk,
        documentId: document.id,
        embedding: embeddings[index] as number[],
      })),
    );

    await deps.updateDocumentStatus(document.id, "ready");

    return {
      documentId: document.id,
      chunkCount: chunks.length,
    };
  } catch (error) {
    await deps.updateDocumentStatus(document.id, "failed");
    throw error;
  }
}
