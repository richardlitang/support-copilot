import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeConfig } from "@/src/server/config/env";
import { buildStoragePath } from "@/src/server/storage/storagePath";

function resolveUploadRoot() {
  const configured = getRuntimeConfig().uploadDir;
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
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
  const storagePath = buildStoragePath({ filename: input.filename, documentId: input.documentId });
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

export function createLocalObjectStorage() {
  return {
    putObject: putLocalObject,
    getObject: getLocalObject,
    deleteObject: deleteLocalObject,
  };
}
