import { getRuntimeConfig } from "@/src/server/config/env";
import { createLocalObjectStorage } from "@/src/server/storage/localObjectStorage";
import { createSupabaseObjectStorage } from "@/src/server/storage/supabaseObjectStorage";

export interface PutObjectInput {
  buffer: Buffer;
  filename: string;
  contentType: string;
  documentId?: string;
}

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<{ storagePath: string }>;
  getObject(storagePath: string): Promise<Buffer>;
  deleteObject(storagePath: string): Promise<void>;
}

function lazySupabaseStorage(): ObjectStorage {
  // Construct the backend (and its Supabase client) only when a method is
  // called, so selecting "supabase" never requires live creds.
  return {
    putObject: (input) => createSupabaseObjectStorage().putObject(input),
    getObject: (storagePath) => createSupabaseObjectStorage().getObject(storagePath),
    deleteObject: (storagePath) => createSupabaseObjectStorage().deleteObject(storagePath),
  };
}

export function getObjectStorage(
  provider: string = getRuntimeConfig().storageProvider,
): ObjectStorage {
  return provider === "supabase" ? lazySupabaseStorage() : createLocalObjectStorage();
}

export function putObject(input: PutObjectInput) {
  return getObjectStorage().putObject(input);
}

export function getObject(storagePath: string) {
  return getObjectStorage().getObject(storagePath);
}

export function deleteObject(storagePath: string) {
  return getObjectStorage().deleteObject(storagePath);
}
