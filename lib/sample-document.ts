import { readFile } from "node:fs/promises";
import path from "node:path";
import { directIngestParsedDocument } from "@/lib/ingest";
import { parseTextDocument } from "@/lib/parse";
import type { DocumentRecord } from "@/lib/types";

export const BUNDLED_SAMPLE_FILENAME = "paybridge-api-support-guide.md";
export const SAMPLE_DOCUMENT_OPT_OUT_COOKIE = "support_sample_doc_removed";

const sampleDocumentPath = path.join(process.cwd(), "demo", "docs", BUNDLED_SAMPLE_FILENAME);

export async function ingestBundledSampleDocument(sessionId: string) {
  const text = await readFile(sampleDocumentPath, "utf8");
  const parsed = parseTextDocument({
    filename: BUNDLED_SAMPLE_FILENAME,
    contentType: "text/markdown",
    text,
    sourceType: "demo",
  });

  return directIngestParsedDocument({
    parsedDocument: parsed,
    sessionId,
  });
}

export function includesBundledSampleDocument(documents: DocumentRecord[]) {
  return documents.some((document) => document.filename === BUNDLED_SAMPLE_FILENAME);
}
