# Code Map

This project is a single Next.js app with server-side route handlers, background workers, and shared domain modules. Use this map to read the repo by runtime responsibility instead of by folder name alone.

## Current Runtime Path

```text
Browser UI
  app/page.tsx
  components/SupportCopilotShell.tsx
  components/{UploadPanel,TicketForm,AnswerPanel,EvidencePanel}.tsx

HTTP boundary
  app/api/documents/route.ts
  app/api/upload/route.ts
  app/api/investigate/route.ts
  app/api/health/route.ts
  app/api/ready/route.ts

Investigation pipeline
  lib/investigate.ts
    -> lib/retrieve.ts
    -> lib/classify.ts
    -> lib/tool-runner.ts
    -> lib/claim-generation.ts
    -> lib/review-*.ts
    -> lib/docs-gap-report.ts

Document ingestion
  app/api/upload/route.ts
    -> src/server/storage/localObjectStorage.ts
    -> src/server/queue/client.ts
    -> src/server/queue/workers/documentIngestionWorker.ts
    -> lib/parse.ts
    -> lib/chunk.ts
    -> lib/embed.ts

Persistence and infrastructure
  lib/db.ts
    -> src/server/db/**
    -> supabase/migrations/**
  src/server/queue/**
  src/server/observability/sentry.ts
```

## Frontend

- `app/page.tsx` is the page entrypoint.
- `components/SupportCopilotShell.tsx` owns client state, API calls, local investigation history, document polling, and panel composition.
- `components/UploadPanel.tsx`, `components/TicketForm.tsx`, `components/AnswerPanel.tsx`, and `components/EvidencePanel.tsx` are presentation/workflow panels.
- `components/ui/**` contains local UI primitives.

## Backend HTTP Layer

Next.js route handlers under `app/api/**/route.ts` are backend code:

- `documents`: list/delete session documents and seed the bundled sample when appropriate.
- `upload`: validate files, store raw objects locally, create document records, and enqueue ingestion.
- `investigate`: validate a ticket request, run the investigation pipeline, persist the result, and return structured output.
- `health` and `ready`: process/dependency checks.

## Domain Pipeline

`lib/investigate.ts` is the current orchestration path. It retrieves evidence, classifies the request, gathers optional tool context, detects conflicts, generates structured claims, applies review policy, persists the result, and builds an inspectable trace.

`lib/claim-generation.ts` is the shared claim-generation boundary used by both the current direct pipeline and the graph-node parity wrappers. Docs-only runs still use the older grounded-answer generator internally, but the conversion into the current structured claim contract lives in one place.

## Ingestion Paths

There are two ingestion entrypoints by design:

- User uploads go through the queue-backed path: `app/api/upload/route.ts` -> BullMQ -> `documentIngestionWorker.ts`.
- Demo/sample setup uses `directIngestParsedDocument` from `lib/ingest.ts` to synchronously seed known documents without starting Redis.

The queued path is the production-style runtime path. The direct path is for deterministic local seed/demo setup.

## Graph Parity Work

`lib/experimental/graph/**` is not the active runtime. It contains typed graph-state wrappers around the current deterministic modules so future LangGraph orchestration can be introduced behind a feature flag and checked against direct-pipeline eval parity.

If you are tracing production behavior today, start with `lib/investigate.ts`, not `lib/experimental/graph/**`.

## Test And Demo Harness

- `tests/**`: unit and integration coverage for retrieval helpers, routing, claim validation, review policy, graph parity wrappers, and pipeline behavior.
- `demo/**`: PayBridge support docs, tickets, account/tool context, and eval cases used for walkthroughs.
- `scripts/run-evals.ts`: seeded regression/eval runner.
- `scripts/seed-demo.ts`: local demo data seeding.
- `scripts/apply-migrations.ts`: local migration helper.
