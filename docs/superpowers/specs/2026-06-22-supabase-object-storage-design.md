# Supabase Object Storage Backend — Design Spec

**Date:** 2026-06-22
**Status:** Approved design, ready for implementation planning
**Scope:** Add a Supabase Storage backend behind the existing object-storage seam, selectable by env, so uploaded files persist in shared object storage instead of pod-local disk. Wire it into the k8s local overlay so the kind run stops returning `ENOENT` for uploaded PDFs.

---

## 1. Problem & Goal

Uploaded file **bytes** are written to pod-local disk via `src/server/storage/localObjectStorage.ts`, while the document **metadata** (including `storagePath`) lives in **hosted Supabase**, which is global across all environments. So a file uploaded in one environment (e.g. `npm run dev`) is unreadable in another (e.g. the kind cluster): the metadata is found, but the bytes aren't on that pod's disk —
`ENOENT: open '/app/uploads/<id>/original.pdf'`. On real multi-node prod, even web↔worker in the same cluster can't share pod disk.

**Goal:** store file bytes in **Supabase Storage** (shared, durable, environment-agnostic — co-located logically with the already-global metadata) behind the existing seam, selectable by `STORAGE_PROVIDER`. Local disk remains the default for `npm run dev`; k8s/prod use Supabase.

## 2. The existing seam

`src/server/storage/localObjectStorage.ts` exposes three functions keyed on a `storagePath` of the form `<documentId>/original.<ext>`:

```ts
putLocalObject({ buffer, filename, contentType, documentId? }): Promise<{ storagePath: string }>
getLocalObject(storagePath: string): Promise<Buffer>
deleteLocalObject(storagePath: string): Promise<void>
```

Three call sites (all import the local backend directly today):
- `app/api/upload/route.ts:112` — `putLocalObject` (web writes the upload).
- `src/server/queue/workers/documentIngestionWorker.ts:128` — `getLocalObject` (worker reads bytes to ingest).
- `app/api/documents/[documentId]/preview/route.ts:62` — `getLocalObject` (web downloads bytes and streams the PDF to the browser).

Supabase Storage is not used anywhere yet.

## 3. Architecture

A thin **selector** module becomes the single import for all call sites; backends implement a shared interface.

```
src/server/storage/
  objectStorage.ts          # NEW — interface + selector (getObject/putObject/deleteObject)
  localObjectStorage.ts     # existing — the "local" backend (unchanged behavior)
  supabaseObjectStorage.ts  # NEW — the "supabase" backend
```

**Interface (in `objectStorage.ts`):**
```ts
export interface ObjectStorage {
  putObject(input: { buffer: Buffer; filename: string; contentType: string; documentId?: string }): Promise<{ storagePath: string }>;
  getObject(storagePath: string): Promise<Buffer>;
  deleteObject(storagePath: string): Promise<void>;
}
```
- A `getObjectStorage(): ObjectStorage` selector reads `STORAGE_PROVIDER` from runtime config: `"supabase"` → the Supabase backend, anything else (default) → an adapter over the existing local functions.
- `objectStorage.ts` also re-exports three thin module-level functions — `putObject`, `getObject`, `deleteObject` — that each call `getObjectStorage()` and delegate. **Call sites import these three** and never reference a concrete backend or `getObjectStorage` directly.

**Local backend:** wrap the existing `putLocalObject/getLocalObject/deleteLocalObject` to satisfy `ObjectStorage`. No behavior change; `localObjectStorage.ts` stays the default for `npm run dev` / offline.

## 4. Supabase backend

`src/server/storage/supabaseObjectStorage.ts` implements `ObjectStorage` using the existing `getSupabaseAdminClient()` (service-role key) and `supabase.storage`:

- **`putObject`**: compute the same key `<documentId>/original.<ext>` (reuse the existing extension/UUID logic — extract a shared `buildStoragePath()` helper so both backends derive identical keys). Ensure the bucket exists (§5), then `supabase.storage.from(bucket).upload(key, buffer, { contentType, upsert: true })`. Return `{ storagePath: key }`.
- **`getObject`**: `supabase.storage.from(bucket).download(key)` → convert the returned Blob to a `Buffer`. Throw a clear error if the object is missing.
- **`deleteObject`**: `supabase.storage.from(bucket).remove([key])`.

**Bucket:** private bucket named from `SUPABASE_STORAGE_BUCKET` (default `support-uploads`). Private is correct — web and worker read bytes server-side with the service key; no public URLs are needed. The bucket is **auto-ensured** (idempotent create-if-missing via the service key) on first write, so there is no manual setup step; a missing-bucket error is surfaced clearly if creation is not permitted.

**Preview route is unchanged in shape:** it still downloads bytes and streams them to the browser, just through `getObject` (Supabase) instead of `getLocalObject` (disk). Session/auth/PDF checks stay as-is. (Signed-URL serving is a future bandwidth optimization, out of scope.)

## 5. Configuration

Add to runtime config (`src/server/config/env.ts`) and `.env.example`:
- `STORAGE_PROVIDER` — `"local"` (default) | `"supabase"`.
- `SUPABASE_STORAGE_BUCKET` — default `"support-uploads"`.

The Supabase backend reuses the existing `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (already required by the app's data layer; already in the k8s Secret).

**k8s wiring:** the local overlay's `patch-config.yaml` sets `STORAGE_PROVIDER: "supabase"`. No new secret keys (service key already present). Result: kind uploads persist to Supabase Storage → the `ENOENT` disappears for new uploads.

## 6. Behavior across environments

- `npm run dev` (default `local`): writes to local disk as today.
- kind / prod (`supabase`): read/write the shared Supabase bucket; bytes are global like the metadata.
- Each environment is internally consistent. A file uploaded under `local` in `dev` is not in the Supabase bucket (and vice-versa) — an accepted edge case, not a regression.

## 7. Error handling

- `putObject` (supabase): bucket-ensure failure and upload failure throw with actionable messages (bucket name, key). `upsert: true` makes re-ingest idempotent.
- `getObject` (supabase): a missing object throws a clear "object not found at <key>" error (so preview/ingest surface a real 404/failure rather than a confusing Blob error).
- Selector: an unknown `STORAGE_PROVIDER` value falls back to `local` with a one-time warning (fail-soft for dev), OR throws if `supabase` is set but `SUPABASE_URL`/key are missing (fail-fast for misconfig). Pick fail-fast on the explicit-supabase-but-misconfigured case.

## 8. Testing

- **Selector** (`objectStorage`): `STORAGE_PROVIDER=supabase` returns the supabase backend; default/unset/other returns local; explicit `supabase` with missing Supabase config throws.
- **Supabase backend**: against a faked `supabase.storage` client — `putObject` builds key `<documentId>/original.pdf`, calls `upload` with the right bucket/contentType/upsert and returns the key; `getObject` converts the downloaded Blob to the original Buffer; `deleteObject` calls `remove([key])`; bucket auto-ensure is invoked. No network.
- **Shared key helper**: `buildStoragePath` yields identical keys for both backends (extension handling, provided vs generated documentId).
- Existing tests must stay green; default-`local` behavior is unchanged.

## 9. Out of scope (YAGNI / deferred)

- Migrating existing document rows whose `storagePath` points at long-gone local disk (the current ENOENT records) — re-upload fixes them; no bulk migration.
- Signed-URL / CDN serving for the preview route (bandwidth optimization).
- S3/R2/GCS backends — the seam makes them easy later, but only Supabase is built now.
- A `STORAGE_PROVIDER=supabase` default for `npm run dev`.
