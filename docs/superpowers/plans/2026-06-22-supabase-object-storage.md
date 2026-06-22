# Supabase Object Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase Storage backend behind the object-storage seam, selectable by `STORAGE_PROVIDER`, so uploaded file bytes persist in shared storage; wire `STORAGE_PROVIDER=supabase` into the k8s local overlay so kind uploads stop returning `ENOENT`.

**Architecture:** A pure `storagePath` key-builder shared by both backends; an `ObjectStorage` interface with two factory backends (`createLocalObjectStorage`, `createSupabaseObjectStorage`); an `objectStorage.ts` selector that picks one by config and re-exports `putObject/getObject/deleteObject`. The three call sites import those three delegates. Local stays the dev default.

**Tech Stack:** TypeScript, Next.js App Router, `@supabase/supabase-js` 2.103 (`.storage.from(bucket).upload/download/remove`, `.storage.getBucket/createBucket`), the existing `getSupabaseAdminClient()` (service-role key), Vitest.

## Global Constraints

- **Seam, not rewrite.** Call sites import `putObject/getObject/deleteObject` from `@/src/server/storage/objectStorage` only — never a concrete backend.
- **`storagePath` semantics unchanged:** object key is `<documentId>/original.<ext>` for both backends; both derive it from one shared `buildStoragePath`.
- **Default provider is `local`.** `STORAGE_PROVIDER=supabase` selects Supabase. The k8s local overlay sets `supabase`.
- **Supabase backend** reuses `getSupabaseAdminClient()` + `SUPABASE_SERVICE_ROLE_KEY` (already required/present). Bucket name from `SUPABASE_STORAGE_BUCKET`, default `support-uploads`, **private**, **auto-ensured** (idempotent create-if-missing).
- **Preview route shape unchanged** — still downloads bytes and streams; just via `getObject`.
- **No new dependency** (`@supabase/supabase-js` already installed).
- **Existing tests stay green;** default-`local` behavior is unchanged.
- **Out of scope:** migrating old local-disk `storagePath` rows; signed-URL serving; S3/R2/GCS.
- **Commits:** conventional; end body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Stage specific files.

---

## File Structure

**New files:**
- `src/server/storage/storagePath.ts` — pure `buildStoragePath` + `extensionFromFilename`. No deps (avoids import cycles).
- `src/server/storage/objectStorage.ts` — `ObjectStorage` interface, `getObjectStorage(provider?)` selector, delegating `putObject/getObject/deleteObject`.
- `src/server/storage/supabaseObjectStorage.ts` — `createSupabaseObjectStorage(deps?)` backend.
- `tests/core/storage-path.test.ts`, `tests/core/object-storage-selector.test.ts`, `tests/core/supabase-object-storage.test.ts`.

**Modified files:**
- `src/server/storage/localObjectStorage.ts` — use `storagePath.ts`; add `createLocalObjectStorage(): ObjectStorage`-shaped factory. Keep existing named exports.
- `src/server/config/env.ts` — add `storageProvider`, `supabaseStorageBucket` to runtime config.
- `.env.example` — document the two vars.
- `app/api/upload/route.ts`, `src/server/queue/workers/documentIngestionWorker.ts`, `app/api/documents/[documentId]/preview/route.ts` — swap to the seam.
- `infra/k8s/local/patch-config.yaml` — `STORAGE_PROVIDER: "supabase"`.

---

## Task 0: Branch off main

- [ ] **Step 1: Create the branch**

Run: `git switch -c supabase-object-storage`
Expected: clean branch `supabase-object-storage` off `main`.

---

## Task 1: Shared storage-path key builder (pure, TDD)

**Files:**
- Create: `src/server/storage/storagePath.ts`
- Create: `tests/core/storage-path.test.ts`

**Interfaces:**
- Produces: `buildStoragePath(input: { filename: string; documentId?: string }): string` → `"<documentId>/original<.ext>"`; `extensionFromFilename(filename: string): string`.

- [ ] **Step 1: Write failing test `tests/core/storage-path.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildStoragePath, extensionFromFilename } from "@/src/server/storage/storagePath";

describe("extensionFromFilename", () => {
  it("returns the lowercased extension", () => {
    expect(extensionFromFilename("Report.PDF")).toBe(".pdf");
  });
  it("returns empty for no/oversized extension", () => {
    expect(extensionFromFilename("noext")).toBe("");
    expect(extensionFromFilename("a.superlongextension")).toBe("");
  });
});

describe("buildStoragePath", () => {
  it("uses the provided documentId and original<ext>", () => {
    expect(buildStoragePath({ filename: "x.pdf", documentId: "doc-1" })).toBe("doc-1/original.pdf");
  });
  it("generates a documentId when absent", () => {
    const p = buildStoragePath({ filename: "x.pdf" });
    expect(p).toMatch(/^[0-9a-f-]{36}\/original\.pdf$/);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/core/storage-path.test.ts`
Expected: FAIL — cannot find module `@/src/server/storage/storagePath`.

- [ ] **Step 3: Create `src/server/storage/storagePath.ts`**

```ts
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/core/storage-path.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/storage/storagePath.ts tests/core/storage-path.test.ts
git commit -m "$(printf 'feat(storage): shared storage-path key builder\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Runtime config — STORAGE_PROVIDER + bucket

**Files:**
- Modify: `src/server/config/env.ts` (add two fields to the object returned by `buildRuntimeConfig`)
- Modify: `.env.example`

**Interfaces:**
- Produces: `getRuntimeConfig().storageProvider: string` (default `"local"`), `getRuntimeConfig().supabaseStorageBucket: string` (default `"support-uploads"`).

- [ ] **Step 1: Add the fields in `src/server/config/env.ts`**

In the object returned by `buildRuntimeConfig()` (the block that includes `uploadDir: readOptionalString("UPLOAD_DIR") || "uploads",`), add:
```ts
    storageProvider: readOptionalString("STORAGE_PROVIDER") || "local",
    supabaseStorageBucket: readOptionalString("SUPABASE_STORAGE_BUCKET") || "support-uploads",
```

- [ ] **Step 2: Document in `.env.example`**

Append:
```bash
# Object storage backend for uploaded files: "local" (disk) or "supabase".
STORAGE_PROVIDER=local
# Supabase Storage bucket used when STORAGE_PROVIDER=supabase.
SUPABASE_STORAGE_BUCKET=support-uploads
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the new fields are typed by inference on the returned object).

- [ ] **Step 4: Commit**

```bash
git add src/server/config/env.ts .env.example
git commit -m "$(printf 'feat(config): add STORAGE_PROVIDER and SUPABASE_STORAGE_BUCKET\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Local backend factory (refactor to shared key builder)

**Files:**
- Modify: `src/server/storage/localObjectStorage.ts`
- Create: `tests/core/local-object-storage.test.ts`

**Interfaces:**
- Consumes: `buildStoragePath` (Task 1).
- Produces: `createLocalObjectStorage(): { putObject; getObject; deleteObject }` with signatures matching the `ObjectStorage` interface (Task 5).

- [ ] **Step 1: Write failing test `tests/core/local-object-storage.test.ts`**

```ts
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/core/local-object-storage.test.ts`
Expected: FAIL — `createLocalObjectStorage` is not exported.

- [ ] **Step 3: Refactor `src/server/storage/localObjectStorage.ts`**

Replace its `extensionFromFilename`/path logic to use the shared builder, and add the factory. Full file:
```ts
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/core/local-object-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/storage/localObjectStorage.ts tests/core/local-object-storage.test.ts
git commit -m "$(printf 'refactor(storage): local backend factory over shared key builder\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Supabase backend (TDD with a faked client)

**Files:**
- Create: `src/server/storage/supabaseObjectStorage.ts`
- Create: `tests/core/supabase-object-storage.test.ts`

**Interfaces:**
- Consumes: `buildStoragePath` (Task 1); `getSupabaseAdminClient` (`@/src/server/db/supabaseAdmin`); `getRuntimeConfig().supabaseStorageBucket` (Task 2).
- Produces: `createSupabaseObjectStorage(deps?: { client?: SupabaseLike; bucket?: string }): { putObject; getObject; deleteObject }`.

- [ ] **Step 1: Write failing test `tests/core/supabase-object-storage.test.ts`**

```ts
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
        buckets.has(name) ? { data: { name }, error: null } : { data: null, error: { message: "not found" } },
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
    await store.putObject({ buffer: Buffer.from("pdfbytes"), filename: "x.pdf", contentType: "application/pdf", documentId: "d2" });
    expect((await store.getObject("d2/original.pdf")).toString()).toBe("pdfbytes");
    await store.deleteObject("d2/original.pdf");
    expect(client.calls.remove[0]).toMatchObject({ bucket: "support-uploads", keys: ["d2/original.pdf"] });
    await expect(store.getObject("d2/original.pdf")).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/core/supabase-object-storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/server/storage/supabaseObjectStorage.ts`**

```ts
import { getRuntimeConfig } from "@/src/server/config/env";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";
import { buildStoragePath } from "@/src/server/storage/storagePath";

type StorageBucketApi = {
  upload: (
    key: string,
    body: Buffer,
    opts: { contentType: string; upsert: boolean },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  download: (
    key: string,
  ) => Promise<{ data: { arrayBuffer: () => Promise<ArrayBuffer | Buffer> } | null; error: { message: string } | null }>;
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
  const client = (deps?.client ?? (getSupabaseAdminClient() as unknown as SupabaseLike));
  const bucket = deps?.bucket ?? getRuntimeConfig().supabaseStorageBucket;

  return {
    async putObject(input: {
      buffer: Buffer;
      filename: string;
      contentType: string;
      documentId?: string;
    }) {
      const storagePath = buildStoragePath({ filename: input.filename, documentId: input.documentId });
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
        throw new Error(`Object not found at '${storagePath}' in bucket '${bucket}': ${error?.message ?? "no data"}`);
      }
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer as ArrayBuffer);
    },

    async deleteObject(storagePath: string) {
      const { error } = await client.storage.from(bucket).remove([storagePath]);
      if (error) {
        throw new Error(`Failed to delete '${storagePath}' from bucket '${bucket}': ${error.message}`);
      }
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/core/supabase-object-storage.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/server/storage/supabaseObjectStorage.ts tests/core/supabase-object-storage.test.ts
git commit -m "$(printf 'feat(storage): supabase storage backend with bucket auto-ensure\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Selector + delegating put/get/deleteObject

**Files:**
- Create: `src/server/storage/objectStorage.ts`
- Create: `tests/core/object-storage-selector.test.ts`

**Interfaces:**
- Consumes: `createLocalObjectStorage` (Task 3), `createSupabaseObjectStorage` (Task 4), `getRuntimeConfig().storageProvider` (Task 2).
- Produces: `ObjectStorage` interface; `getObjectStorage(provider?: string): ObjectStorage`; `putObject`, `getObject`, `deleteObject`.

- [ ] **Step 1: Write failing test `tests/core/object-storage-selector.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getObjectStorage } from "@/src/server/storage/objectStorage";

describe("getObjectStorage", () => {
  it("returns a backend exposing put/get/deleteObject for local", () => {
    const store = getObjectStorage("local");
    expect(typeof store.putObject).toBe("function");
    expect(typeof store.getObject).toBe("function");
    expect(typeof store.deleteObject).toBe("function");
  });
  it("returns a (distinct) backend for supabase without throwing at selection time", () => {
    // Selecting supabase must not require live creds; the supabase client is
    // only constructed lazily inside the backend's methods.
    expect(() => getObjectStorage("supabase")).not.toThrow();
  });
  it("defaults unknown/empty providers to local-shaped backend", () => {
    expect(typeof getObjectStorage("nonsense").putObject).toBe("function");
  });
});
```

> Note: for the supabase branch to be constructible without live creds, `createSupabaseObjectStorage()` must defer `getSupabaseAdminClient()` until a method runs. Implement the selector so it constructs the backend lazily (see Step 3).

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/core/object-storage-selector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/server/storage/objectStorage.ts`**

The supabase backend is wrapped so its client is resolved lazily per call (selection never needs creds).
```ts
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
  // Construct the backend (and its Supabase client) only when a method is called,
  // so selecting "supabase" never requires live creds.
  return {
    putObject: (input) => createSupabaseObjectStorage().putObject(input),
    getObject: (storagePath) => createSupabaseObjectStorage().getObject(storagePath),
    deleteObject: (storagePath) => createSupabaseObjectStorage().deleteObject(storagePath),
  };
}

export function getObjectStorage(provider: string = getRuntimeConfig().storageProvider): ObjectStorage {
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/core/object-storage-selector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/storage/objectStorage.ts tests/core/object-storage-selector.test.ts
git commit -m "$(printf 'feat(storage): object-storage selector and delegates\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Swap the three call sites to the seam

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `src/server/queue/workers/documentIngestionWorker.ts`
- Modify: `app/api/documents/[documentId]/preview/route.ts`

- [ ] **Step 1: `app/api/upload/route.ts`**

Replace `import { putLocalObject } from "@/src/server/storage/localObjectStorage";` with `import { putObject } from "@/src/server/storage/objectStorage";` and change the call `await putLocalObject({` → `await putObject({` (args unchanged).

- [ ] **Step 2: `src/server/queue/workers/documentIngestionWorker.ts`**

Replace `import { getLocalObject } from "@/src/server/storage/localObjectStorage";` with `import { getObject } from "@/src/server/storage/objectStorage";` and change `await getLocalObject(document.storagePath)` → `await getObject(document.storagePath)`.

- [ ] **Step 3: `app/api/documents/[documentId]/preview/route.ts`**

Replace `import { getLocalObject } from "@/src/server/storage/localObjectStorage";` with `import { getObject } from "@/src/server/storage/objectStorage";` and change `await getLocalObject(document.storagePath)` → `await getObject(document.storagePath)`.

- [ ] **Step 4: Verify no stale direct imports + full gate**

Run:
```bash
grep -rn "putLocalObject\|getLocalObject\|deleteLocalObject" app src --include="*.ts" --include="*.tsx" | grep -v "storage/localObjectStorage.ts"
```
Expected: no results (all call sites now go through the seam).
Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS; full suite green (122 prior + the new storage tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts src/server/queue/workers/documentIngestionWorker.ts "app/api/documents/[documentId]/preview/route.ts"
git commit -m "$(printf 'refactor(storage): route upload/ingest/preview through the seam\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Wire k8s overlay + live validation

**Files:**
- Modify: `infra/k8s/local/patch-config.yaml`

- [ ] **Step 1: Set the provider in `infra/k8s/local/patch-config.yaml`**

Add to the ConfigMap `data:` block:
```yaml
  STORAGE_PROVIDER: "supabase"
```
(The Secret already supplies `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; the bucket defaults to `support-uploads`.)

- [ ] **Step 2: Overlay still renders + check:k8s**

Run: `npm run check:k8s`
Expected: renders base + local successfully; the local ConfigMap now carries `STORAGE_PROVIDER: supabase`.

- [ ] **Step 3: Live Supabase round-trip (real creds)**

With `.env.local` present (has `SUPABASE_URL` + service key), exercise the real backend end-to-end:
```bash
node --import tsx -e '
import { createSupabaseObjectStorage } from "./src/server/storage/supabaseObjectStorage";
const s = createSupabaseObjectStorage();
const key = (await s.putObject({ buffer: Buffer.from("roundtrip-"+Date.now()), filename: "probe.pdf", contentType: "application/pdf", documentId: "selftest" })).storagePath;
const got = (await s.getObject(key)).toString();
console.log("got:", got);
await s.deleteObject(key);
console.log("deleted ok");
'
```
Expected: prints the round-tripped bytes then `deleted ok` — proving bucket auto-ensure + upload/download/delete against the real Supabase project.

- [ ] **Step 4: End-to-end in kind**

Run: `make local-up`, then upload a PDF (UI at http://localhost:8080 or `curl -F` to `/api/upload`), confirm it ingests and the preview route returns the PDF (HTTP 200) — i.e. no `ENOENT`. Then `make local-down`.

- [ ] **Step 5: Commit**

```bash
git add infra/k8s/local/patch-config.yaml
git commit -m "$(printf 'feat(k8s): use supabase object storage in local overlay\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Notes for the implementer

- **Lazy supabase construction matters:** the selector must not call `getSupabaseAdminClient()` at selection time (it throws without creds). Task 5's `lazySupabaseStorage` defers it to method-call time — keep that shape.
- **`vi.stubEnv` + the config cache:** `getRuntimeConfig()` memoizes (`cachedConfig`). The local-backend test stubs `UPLOAD_DIR` before the first `getRuntimeConfig()` call in that worker; if a test needs a *different* env after the cache is warm, run it in its own file/process. The provided tests avoid this by stubbing before first use.
- **`upsert: true`** makes re-ingest/re-upload idempotent (same key overwrites).
- **Do not migrate old rows** — pre-existing documents whose `storagePath` points at vanished local disk still fail preview; re-upload fixes them. This is the spec's out-of-scope.
- **Bucket is private** — never make it public; reads go through the service key server-side.
