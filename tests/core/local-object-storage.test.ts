import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "obj-"));
  vi.stubEnv("UPLOAD_DIR", dir);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("createLocalObjectStorage", () => {
  it("round-trips put/get/delete with a stable key", async () => {
    const { createLocalObjectStorage } = await import("@/src/server/storage/localObjectStorage");
    const store = createLocalObjectStorage();
    const { storagePath } = await store.putObject({
      buffer: Buffer.from("hello pdf"),
      filename: "x.pdf",
      contentType: "application/pdf",
      documentId: "doc-1",
    });
    expect(storagePath).toBe("doc-1/original.pdf");
    expect((await store.getObject(storagePath)).toString()).toBe("hello pdf");
    await store.deleteObject(storagePath);
    await expect(store.getObject(storagePath)).rejects.toThrow();
  });
});
