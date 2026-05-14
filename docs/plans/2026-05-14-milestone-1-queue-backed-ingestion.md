# Feature: Milestone 1 Queue-Backed Ingestion

## Goal
Prove the prototype-to-operable-system transformation with one end-to-end queue-backed ingestion vertical slice.

## Architecture Overview
Uploads persist raw files to a durable local storage path and create `documents` rows with `uploaded` status. BullMQ carries only IDs to a worker, which reads the stored file, parses/chunks/embeds it, replaces chunks idempotently, writes safe pipeline events, and marks the document `ready` or `failed`.

## Tech Stack
- Next.js App Router API routes
- Supabase-compatible SQL migrations
- Direct `pg` helpers for local Docker/worker operational paths
- BullMQ + Redis
- Local filesystem object storage for Milestone 1
- Deterministic mock AI embeddings for local/CI plumbing

## Non-Goals
- Sentry, Trivy, Dependabot, OpenTofu, Playwright, Ollama, hosted storage, hosted deployment, auth redesign, dashboards, and large documentation rewrites.

## Tasks

### Task 1: Add Milestone 1 Schema
**Files:**
- Modify: `supabase/migrations/*`
- Modify: `lib/types.ts`

**Action:** Add `uploaded` and `archived` statuses, `storage_path`, error fields, timestamps, unique chunk index, and `pipeline_events`.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `feat(infra): add queue ingestion schema`

### Task 2: Add Config and Safe Storage
**Files:**
- Modify: `lib/env.ts`
- Add: `src/server/storage/localObjectStorage.ts`

**Action:** Add centralized config values for DB, Redis, AI provider, uploads, and local object storage.

**Verify:**
```bash
npm run test -- tests/config.test.ts
```

**Commit:** `feat(config): add milestone one runtime config`

### Task 3: Add Direct DB Helpers
**Files:**
- Add: `src/server/db/client.ts`
- Add: `src/server/db/documents.ts`
- Add: `src/server/db/chunks.ts`
- Add: `src/server/db/pipelineEvents.ts`
- Add: `src/server/db/health.ts`

**Action:** Provide narrow operational DB access for worker, readiness, chunk replacement, and pipeline events.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `feat(db): add operational helpers`

### Task 4: Add Mock AI Provider
**Files:**
- Add: `src/server/ai/provider.ts`
- Modify: `lib/embed.ts`

**Action:** Select mock or OpenAI centrally. Mock embeddings are deterministic 1536-dimensional vectors.

**Verify:**
```bash
npm run test -- tests/ai-provider.test.ts
```

**Commit:** `feat(ai): add deterministic mock provider`

### Task 5: Add Queue and Worker
**Files:**
- Add: `src/server/queue/names.ts`
- Add: `src/server/queue/jobs.ts`
- Add: `src/server/queue/client.ts`
- Add: `src/server/queue/workers/documentIngestionWorker.ts`
- Add: `src/server/queue/workers/index.ts`

**Action:** Enqueue document ingestion jobs with retries/backoff and process them in a separate worker.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `feat(queue): add document ingestion worker`

### Task 6: Wire Upload to Async Ingestion
**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `components/SupportCopilotShell.tsx`
- Modify: `components/UploadPanel.tsx`

**Action:** Persist files, create uploaded rows, enqueue jobs, return accepted/processing outcomes, and poll while documents are non-ready.

**Verify:**
```bash
npm run test
```

**Commit:** `feat(upload): enqueue document ingestion`

### Task 7: Add Health and Readiness
**Files:**
- Add: `app/api/health/route.ts`
- Add: `app/api/ready/route.ts`

**Action:** Return liveness and dependency readiness without leaking secrets.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `feat(health): add readiness endpoints`

### Task 8: Add Docker Local Stack
**Files:**
- Add: `Dockerfile`
- Add: `docker-compose.yml`
- Add: `.dockerignore`
- Modify: `package.json`

**Action:** Run app, worker, Postgres/pgvector, and Redis locally.

**Verify:**
```bash
docker compose config
```

**Commit:** `feat(docker): add local app stack`

### Task 9: Add Verification Script
**Files:**
- Add: `scripts/verify-milestone1.sh`
- Modify: `package.json`

**Action:** Add one command to verify the local milestone path.

**Verify:**
```bash
npm run verify:milestone1
```

**Commit:** `test(infra): add milestone one verification`

### Task 10: Update Minimal Docs
**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Action:** Add local Docker, env, and Milestone 1 operating notes only.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `docs(infra): document milestone one operations`
