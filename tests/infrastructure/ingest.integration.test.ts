import { directIngestParsedDocument } from "@/src/server/ingestion/directIngest";
import { parseTextDocument } from "@/src/server/ingestion/parse";

describe("directIngestParsedDocument", () => {
  it("chunks, embeds, and persists a parsed document", async () => {
    const parsed = parseTextDocument({
      filename: "exports.md",
      contentType: "text/markdown",
      text: "# Common export failures\nCheck billing setup.\n\n## Permissions required\nNeed Exports: Write.",
    });
    const statuses: string[] = [];
    const insertedRows: Array<{ content: string; documentId: string; embedding: number[] }> = [];

    const result = await directIngestParsedDocument(
      {
        parsedDocument: parsed,
        sessionId: "test-session",
      },
      {
        createDocumentRecord: async () => ({
          id: "doc-1",
          sessionId: "test-session",
          filename: parsed.filename,
          contentType: parsed.contentType,
          status: "processing",
          createdAt: new Date().toISOString(),
        }),
        updateDocumentStatus: async (_documentId, status) => {
          statuses.push(status);
        },
        insertDocumentChunks: async (rows) => {
          insertedRows.push(...rows);
        },
        embedTexts: async (texts) => texts.map((_, index) => [index + 0.1, index + 0.2]),
      },
    );

    expect(result.documentId).toBe("doc-1");
    expect(result.chunkCount).toBe(insertedRows.length);
    expect(insertedRows[0]?.documentId).toBe("doc-1");
    expect(insertedRows[0]?.embedding).toEqual([0.1, 0.2]);
    expect(statuses).toEqual(["ready"]);
  });
});
