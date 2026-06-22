import { describe, expect, it, vi } from "vitest";
import { createSupabaseObjectStorage } from "@/src/server/storage/supabaseObjectStorage";

function fakeClient() {
  const store = new Map<string, Buffer>();
  const calls: { upload: any[]; remove: any[] } = { upload: [], remove: [] };
  const buckets = new Set<string>();
  return {
    calls,
    buckets,
    storage: {
      getBucket: vi.fn(async (name: string) =>
        buckets.has(name)
          ? { data: { name }, error: null }
          : { data: null, error: { message: "not found" } },
      ),
      createBucket: vi.fn(async (name: string) => {
        buckets.add(name);
        return { data: { name }, error: null };
      }),
      from(bucket: string) {
        return {
          upload: vi.fn(async (key: string, buffer: Buffer, opts: any) => {
            calls.upload.push({ bucket, key, opts });
            store.set(`${bucket}/${key}`, buffer);
            return { data: { path: key }, error: null };
          }),
          download: vi.fn(async (key: string) => {
            const buf = store.get(`${bucket}/${key}`);
            if (!buf) return { data: null, error: { message: "not found" } };
            return { data: { arrayBuffer: async () => buf }, error: null };
          }),
          remove: vi.fn(async (keys: string[]) => {
            calls.remove.push({ bucket, keys });
            keys.forEach((k) => store.delete(`${bucket}/${k}`));
            return { data: {}, error: null };
          }),
        };
      },
    },
  };
}

describe("createSupabaseObjectStorage", () => {
  it("auto-ensures the bucket and uploads with key/contentType/upsert", async () => {
    const client = fakeClient();
    const store = createSupabaseObjectStorage({ client: client as any, bucket: "support-uploads" });
    const { storagePath } = await store.putObject({
      buffer: Buffer.from("hello"),
      filename: "x.pdf",
      contentType: "application/pdf",
      documentId: "doc-1",
    });
    expect(storagePath).toBe("doc-1/original.pdf");
    expect(client.buckets.has("support-uploads")).toBe(true);
    expect(client.calls.upload[0]).toMatchObject({
      bucket: "support-uploads",
      key: "doc-1/original.pdf",
      opts: { contentType: "application/pdf", upsert: true },
    });
  });

  it("round-trips get and delete", async () => {
    const client = fakeClient();
    const store = createSupabaseObjectStorage({ client: client as any, bucket: "support-uploads" });
    await store.putObject({
      buffer: Buffer.from("pdfbytes"),
      filename: "x.pdf",
      contentType: "application/pdf",
      documentId: "d2",
    });
    expect((await store.getObject("d2/original.pdf")).toString()).toBe("pdfbytes");
    await store.deleteObject("d2/original.pdf");
    expect(client.calls.remove[0]).toMatchObject({
      bucket: "support-uploads",
      keys: ["d2/original.pdf"],
    });
    await expect(store.getObject("d2/original.pdf")).rejects.toThrow(/not found/i);
  });
});
