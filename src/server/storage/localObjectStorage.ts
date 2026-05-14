import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeConfig } from "@/lib/env";

function extensionFromFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension && extension.length <= 12 ? extension : "";
}

function resolveUploadRoot() {
  const configured = getRuntimeConfig().uploadDir;
  return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function resolveStoragePath(storagePath: string) {
  if (storagePath.includes("..") || path.isAbsolute(storagePath)) {
    throw new Error("Invalid storage path.");
  }

  return path.join(resolveUploadRoot(), storagePath);
}

export async function putLocalObject(input: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  documentId?: string;
}) {
  const documentId = input.documentId ?? randomUUID();
  const storagePath = path.join(documentId, `original${extensionFromFilename(input.filename)}`);
  const fullPath = resolveStoragePath(storagePath);

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.buffer);

  return { storagePath };
}

export async function getLocalObject(storagePath: string) {
  return readFile(resolveStoragePath(storagePath));
}

export async function deleteLocalObject(storagePath: string) {
  await unlink(resolveStoragePath(storagePath));
}
