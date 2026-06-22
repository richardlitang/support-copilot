import { getRuntimeConfig } from "@/src/server/config/env";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";
import { buildStoragePath } from "@/src/server/storage/storagePath";

type StorageBucketApi = {
  upload: (
    key: string,
    body: Buffer,
    opts: { contentType: string; upsert: boolean },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  download: (key: string) => Promise<{
    data: { arrayBuffer: () => Promise<ArrayBuffer | Buffer> } | null;
    error: { message: string } | null;
  }>;
  remove: (keys: string[]) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type SupabaseLike = {
  storage: {
    getBucket: (name: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    createBucket: (
      name: string,
      opts?: { public?: boolean },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    from: (bucket: string) => StorageBucketApi;
  };
};

async function ensureBucket(client: SupabaseLike, bucket: string) {
  const existing = await client.storage.getBucket(bucket);
  if (existing.data) {
    return;
  }
  const created = await client.storage.createBucket(bucket, { public: false });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(`Failed to ensure storage bucket '${bucket}': ${created.error.message}`);
  }
}

export function createSupabaseObjectStorage(deps?: { client?: SupabaseLike; bucket?: string }) {
  const client = deps?.client ?? (getSupabaseAdminClient() as unknown as SupabaseLike);
  const bucket = deps?.bucket ?? getRuntimeConfig().supabaseStorageBucket;

  return {
    async putObject(input: {
      buffer: Buffer;
      filename: string;
      contentType: string;
      documentId?: string;
    }) {
      const storagePath = buildStoragePath({
        filename: input.filename,
        documentId: input.documentId,
      });
      await ensureBucket(client, bucket);
      const { error } = await client.storage
        .from(bucket)
        .upload(storagePath, input.buffer, { contentType: input.contentType, upsert: true });
      if (error) {
        throw new Error(`Failed to upload '${storagePath}' to bucket '${bucket}': ${error.message}`);
      }
      return { storagePath };
    },

    async getObject(storagePath: string) {
      const { data, error } = await client.storage.from(bucket).download(storagePath);
      if (error || !data) {
        throw new Error(
          `Object not found at '${storagePath}' in bucket '${bucket}': ${error?.message ?? "no data"}`,
        );
      }
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer as ArrayBuffer);
    },

    async deleteObject(storagePath: string) {
      const { error } = await client.storage.from(bucket).remove([storagePath]);
      if (error) {
        throw new Error(
          `Failed to delete '${storagePath}' from bucket '${bucket}': ${error.message}`,
        );
      }
    },
  };
}
