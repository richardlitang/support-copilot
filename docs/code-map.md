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
  src/server/investigation/investigate.ts
    -> src/server/investigation/stages.ts
    -> src/server/investigation/trace.ts
    -> src/server/retrieval/retrieve.ts
    -> lib/classify.ts
    -> lib/tool-runner.ts
    -> lib/claim-generation.ts
    -> lib/review-*.ts
    -> lib/docs-gap-report.ts

Document ingestion
  app/api/upload/route.ts
    -> src/server/db/documentIngestionJobs.ts
    -> src/server/storage/localObjectStorage.ts
    -> src/server/queue/client.ts
    -> src/server/queue/workers/documentIngestionWorker.ts
    -> src/server/ingestion/parse.ts
    -> lib/chunk.ts
    -> src/server/ai/embed.ts

Persistence and infrastructure
  src/server/db/index.ts
    -> src/server/db/**
    -> supabase/migrations/**
  src/server/queue/**
  src/server/observability/sentry.ts
```

## Folder Ownership

- `app/**`: Next.js page and API route boundaries.
- `components/**`: client-facing workflow and UI components. Components may import shared types/helpers from `lib`, but not backend runtime modules from `src/server`.
- `src/server/**`: backend runtime code, including database adapters, AI providers, ingestion, retrieval, queue workers, observability, session handling, and investigation orchestration.
- `lib/**`: shared domain policies, value helpers, contracts, and UI-safe utilities. Server-only runtime code should not be added here.
- `tests/**`, `scripts/**`, and `demo/**`: regression harnesses, local setup tools, and deterministic demo/eval fixtures.

## Frontend

- `app/page.tsx` is the page entrypoint.
- `components/SupportCopilotShell.tsx` owns client state, API calls, local investigation history, document polling, and panel composition.
- `components/UploadPanel.tsx`, `components/TicketForm.tsx`, `components/AnswerPanel.tsx`, and `components/EvidencePanel.tsx` are presentation/workflow panels.
- `components/upload/*` contains focused upload UI sections (`intake-dropzone`, `session-docs-list`, `latest-ingestion`).
- `components/ui/**` contains local UI primitives.

## Backend HTTP Layer

Next.js route handlers under `app/api/**/route.ts` are backend code:

- `documents`: list/delete session documents and seed the bundled sample when appropriate.
- `upload`: validate files, store raw objects locally, create document + ingestion-job records, and enqueue ingestion.
- `investigate`: validate a ticket request, run the investigation pipeline, persist the result, and return structured output.
- `health` and `ready`: process/dependency checks.

## Domain Pipeline

`src/server/investigation/investigate.ts` is the current orchestration entrypoint. Stage logic now lives in `src/server/investigation/stages.ts` and trace rendering payload assembly lives in `src/server/investigation/trace.ts`.

`lib/claim-generation.ts` is the shared claim-generation boundary used by the current direct pipeline. Docs-only runs still use the older grounded-answer generator internally, but the conversion into the current structured claim contract lives in one place.

## Ingestion Paths

There are two ingestion entrypoints by design:

- User uploads go through the queue-backed path: `app/api/upload/route.ts` -> BullMQ -> `documentIngestionWorker.ts`.
- Demo/sample setup uses `directIngestParsedDocument` from `src/server/ingestion/directIngest.ts` to synchronously seed known documents without starting Redis.

The queued path is the production-style runtime path. The direct path is for deterministic local seed/demo setup.

`document_ingestion_jobs` is the operational queue-state table for the queued path. It tracks queue job id, attempt counts, worker lock metadata, safe error details, and terminal state independently from `documents.status`.

## Test And Demo Harness

- `tests/ai/**`: answer-generation and model-boundary tests.
- `tests/core/**`: routing/review/policy/value-level core checks.
- `tests/investigation/**`: pipeline orchestration and structured investigation tests.
- `tests/retrieval/**`: retrieval helper and ranking tests.
- `tests/infrastructure/**`: ingestion and tool-runner integration tests.
- `demo/**`: PayBridge support docs, tickets, account/tool context, and eval cases used for walkthroughs.
- `scripts/run-evals.ts`: seeded regression/eval runner.
- `scripts/evals/*`: eval runner support modules for offline fixtures, types, and shared utilities.
- `scripts/seed-demo.ts`: local demo data seeding.
- `scripts/apply-migrations.ts`: local migration helper.
