# Support Copilot

Support Copilot is a single-app Next.js support investigation workspace built to show real retrieval and grounding instead of hiding it behind chat UI. Users start with a bundled PayBridge sample support guide or upload their own docs, paste a ticket, inspect retrieved chunks and tool outputs, and receive grounded customer-facing and internal outputs with citations or an explicit human-review fallback.

## About the project

- A real RAG pipeline over uploaded support documentation with dense retrieval, literal candidate expansion, and optional reranking
- Deterministic routing between docs-only, docs-plus-context, and human-review modes
- Structured outputs with claim-level citations instead of freeform answer blobs
- A debug surface that makes retrieval, evidence, and fallback behavior inspectable

## Why this project matters

- It treats trust as a product requirement, not a post-processing layer.
- It makes retrieval, evidence, and review states inspectable end-to-end.
- It favors deterministic control flow for critical routing/review boundaries.
- It encodes AI fallibility as a first-class state (`needs_human_review`) instead of masking uncertainty.

## Reviewer quickstart

1. Read [`docs/code-map.md`](docs/code-map.md) for runtime boundaries.
2. Read [`docs/architecture.md`](docs/architecture.md) for system flow and trust model.
3. Read [`docs/threat-model.md`](docs/threat-model.md) for data/security assumptions.
4. Read ADRs in [`docs/adr`](docs/adr) for decision rationale.
5. Run `npm run verify` for the full quality gate.
6. Run `npm run eval:demo` for live retrieval-quality checks.

<img width="1280" height="694" alt="chrome-capture-2026-05-05" src="https://github.com/user-attachments/assets/ddde7941-f7d4-4344-b5ac-81ecbb2ebdf2" />

## Project Goals

- The app makes retrieval visible in the UI instead of hiding it inside one answer box.
- Customer-facing output and internal diagnosis are separated so support reasoning stays inspectable.
- Weak or conflicting evidence routes to `needs_human_review` instead of bluffing.
- Failed or weak-support runs produce a structured docs-gap report so teams leave with a reusable documentation issue, not just a refusal.
- Demo and regression behavior should stay repeatable through canonical scenarios and a seeded eval suite.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres with pgvector
- OpenAI embeddings and structured answer generation
- Vitest for unit and pipeline tests

## Architecture

For a fuller walkthrough, see [`docs/architecture.md`](docs/architecture.md).
For a file-by-file orientation, see [`docs/code-map.md`](docs/code-map.md).

- `app/api/upload/route.ts`: upload, parse, chunk, embed, and persist documents
- `app/api/investigate/route.ts`: retrieve docs, deterministically decide whether tools are needed, run tool-backed investigation, and store structured investigation metadata
- `lib/parse.ts`: text extraction and heading-aware parsing
- `lib/chunk.ts`: deterministic chunking for retrieval
- `lib/retrieve.ts`: dense retrieval against `match_document_chunks`, literal-aware candidate expansion, candidate merging, and reranking
- `lib/literal-retrieval.ts` and `lib/rerank.ts`: deterministic literal extraction and hosted reranker adapter
- `lib/docs-gap-report.ts`: structured documentation-gap artifact generation for failed or weak-support runs
- `lib/answer.ts`: stable facade for answer generation modules in `lib/ai/**`
- `lib/classify.ts`: deterministic routing for docs-only vs docs-plus-tools vs human-review
- `lib/tools/*`: Postgres-backed read-only investigation tools for account context, feature flags, and recent errors
- `lib/investigate.ts`: investigation orchestration boundary (stages in `lib/investigation/**`)
- `lib/claim-generation.ts`: shared structured-claim generation boundary used by the direct pipeline and graph parity wrappers
- `lib/ingest.ts`: direct seed/demo ingestion helper; user uploads use the queue-backed worker path

## Retrieval Surfacing

- Customer-facing output and internal diagnosis both render as cited structured claims instead of freeform prose.
- The evidence panel shows retrieved document chunks separately from product-context tool evidence and raw tool calls.
- Document evidence preserves retrieval provenance: vector, literal, or hybrid candidate source, plus rerank score when available.
- Citation labels such as `[S1]` and `[T1]` map directly from claims to document and tool evidence.
- A grounding validator rejects uncited output, unknown citations, over-broad claims, and claims with no meaningful overlap with cited evidence.
- If retrieval is weak, account context is missing, or docs and tools do not explain the issue, the app routes to `needs_human_review` and emits a docs-gap report.
- Current-schema deployments can persist the ticket, investigation record, source links, and tool-call records through a single database function so the UI does not land on a half-saved investigation.
- Supabase access is server-side only; public table access and investigation RPC execution are locked down for `anon` and `authenticated` roles.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local`.

For local-first Milestone 1 development, the required values are:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/support_copilot`
- `REDIS_URL=redis://localhost:6379`
- `AI_PROVIDER=mock`
- `UPLOAD_DIR=uploads`

`AI_PROVIDER=mock` uses deterministic 1536-dimensional embeddings so tests and local verification do not require paid APIs. Set `AI_PROVIDER=openai` only when you want live model quality, then provide `OPENAI_API_KEY`.

Hosted Supabase mode remains optional. If using hosted Supabase instead of local Docker Postgres, fill in:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
- optional `COHERE_API_KEY` for hosted reranking

`SUPABASE_URL` should be the project HTTP URL such as `https://<project-ref>.supabase.co`. If you only have the Postgres connection string, the app will derive the HTTP project URL from it.

Without `COHERE_API_KEY`, retrieval still runs with merged vector and literal candidates. With it, the app reranks the merged candidate set using `COHERE_RERANK_MODEL` before selecting final evidence.

If investigation inserts fail with missing `mode`, `review_status`, `account_id`, `customer_reply_json`, or `internal_diagnosis_json`, apply the chunk 2 migration. Apply the atomic investigation-run migration as well so ticket, investigation, source, and tool-call rows are written in one database transaction. Current app code requires the atomic write path.

3. Apply the SQL migrations in `supabase/migrations/` to your Supabase project.

4. Start the app:

```bash
npm run dev
```

5. Optional: seed the demo corpus and seeded support context:

```bash
npm run seed:demo
```

## Run Locally with Docker

Milestone 1 local infrastructure runs app, worker, Postgres with pgvector, and Redis:

```bash
npm run docker:up
```

In another terminal:

```bash
npm run db:migrate
npm run verify:milestone1
```

If host ports are already in use, override them without changing defaults:

```bash
APP_PORT=3001 POSTGRES_PORT=5433 REDIS_PORT=6380 npm run docker:up
APP_URL=http://localhost:3001 DATABASE_URL=postgresql://postgres:postgres@localhost:5433/support_copilot REDIS_URL=redis://localhost:6380 npm run verify:milestone1
```

The upload path is asynchronous in this mode:

1. `/api/upload` stores the raw file in local durable storage and creates a document with `uploaded` status.
2. BullMQ enqueues a `DOCUMENT_INGESTION` job containing IDs only.
3. The worker reads `documents.storage_path`, parses/chunks/embeds the document, replaces chunks idempotently, and marks the document `ready` or `failed`.
4. `/api/investigate` retrieves only `ready` documents.

`/api/health` verifies the app process is alive. `/api/ready` checks required dependencies without exposing secrets.

## Safe Observability

Logs and pipeline events may include IDs, statuses, counts, durations, provider names, and sanitized error codes/messages. They must not include raw uploaded files, extracted text, full prompts, full model responses, embeddings, secrets, headers, cookies, or request bodies.

Pipeline events are stored in `pipeline_events` and are intended as a safe operational audit trail for ingestion and investigation state transitions.

Optional error tracking is supported through `SENTRY_DSN`. When configured, server and worker exceptions are captured with safe tags/context (route, request/job IDs, status/error codes) and without raw document content, prompts, embeddings, or secrets. Sentry-compatible backends such as GlitchTip can be used by setting `SENTRY_DSN` to the compatible ingest DSN.

## Demo Data

- `demo/docs/paybridge-api-support-guide.md`: bundled PayBridge sample support guide for the default app walkthrough
- `demo/docs`: additional seeded support documents used by the eval suite
- `demo/support-context.json`: 5 seeded accounts, feature flags, and recent error events
- `demo/tickets.json`: PayBridge sample test cases for live walkthroughs
- `demo/evals.json`: eval tickets spanning docs-only, docs-plus-tools, unsupported, missing-account, and unresolved-conflict cases

## Canonical Demo Flow

For a 3-minute interview walkthrough, see [`docs/demo-script.md`](docs/demo-script.md).

Use these PayBridge sample test cases in the UI before a live walkthrough:

1. `Live mode mismatch`: grounded answer from a literal error code
2. `Webhook signature`: literal retrieval around `webhook_signature_failed`
3. `Idempotency key`: duplicate-request guidance with exact code evidence
4. `Invoice vs webhook`: diagnostic checklist when more identifiers are needed
5. `Weak evidence`: docs-gap behavior for an under-specified ticket

Expected UI behavior for the bundled PayBridge samples:

- The main product-support cases should return `Answer ready` with `docs only` mode and cited claims.
- `Weak evidence` and `Unsupported topic` should intentionally route to `needs_human_review` with a docs-gap report.
- The pipeline trace is collapsed by default so demos stay focused, but it can be expanded to inspect each retrieval, routing, drafting, review, and persistence step.

## Eval Loop

Run the seeded eval suite after seeding the corpus:

```bash
npm run eval:demo
```

For restricted/offline environments, use:

```bash
npm run eval:demo:offline
```

The offline eval uses mocked retrieved evidence and tool outputs. It also checks graph-node parity for route and review outcomes. `lib/experimental/graph/**` is parity scaffolding for future orchestration, not the active runtime path. The live eval is still the real retrieval-quality gate.

The eval runner now reports route correctness, review status, retrieval evidence keywords, tool evidence, and top retrieved docs. It exits non-zero if the grounded behavior drifts.

For release gates and failure interpretation, see [`docs/evals.md`](docs/evals.md).

## Verification

Run these before claiming the slice is ready:

```bash
npm run lint
npm run format:check
npm run test
npm run build
npm run eval:demo
```

## CI and Security Automation

GitHub Actions now includes:

- `.github/workflows/ci.yml`: lint, format check, typecheck, unit tests, production build, and Docker build on PR/push.
- `.github/workflows/security.yml`: Trivy filesystem and image scans on PR/push, plus weekly scheduled scan.

Dependency update automation:

- `.github/dependabot.yml`: weekly update PRs for npm packages and GitHub Actions workflows.
