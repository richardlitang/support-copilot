import { randomUUID } from "node:crypto";
import path from "node:path";

export function extensionFromFilename(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return extension && extension.length <= 12 ? extension : "";
}

export function buildStoragePath(input: { filename: string; documentId?: string }): string {
  const documentId = input.documentId ?? randomUUID();
  return path.join(documentId, `original${extensionFromFilename(input.filename)}`);
}
