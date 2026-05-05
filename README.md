# Support Copilot

Support Copilot is a single-app Next.js support investigation workspace built to show real retrieval and grounding instead of hiding it behind chat UI. Users start with a bundled PayBridge sample support guide or upload their own docs, paste a ticket, inspect retrieved chunks and tool outputs, and receive grounded customer-facing and internal outputs with citations or an explicit human-review fallback.

## About the project

- A real RAG pipeline over uploaded support documentation with dense retrieval, literal candidate expansion, and optional reranking
- Deterministic routing between docs-only, docs-plus-context, and human-review modes
- Structured outputs with claim-level citations instead of freeform answer blobs
- A debug surface that makes retrieval, evidence, and fallback behavior inspectable

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

- `app/api/upload/route.ts`: upload, parse, chunk, embed, and persist documents
- `app/api/investigate/route.ts`: retrieve docs, deterministically decide whether tools are needed, run tool-backed investigation, and store structured investigation metadata
- `lib/parse.ts`: text extraction and heading-aware parsing
- `lib/chunk.ts`: deterministic chunking for retrieval
- `lib/retrieve.ts`: dense retrieval against `match_document_chunks`, literal-aware candidate expansion, candidate merging, and reranking
- `lib/literal-retrieval.ts` and `lib/rerank.ts`: deterministic literal extraction and hosted reranker adapter
- `lib/docs-gap-report.ts`: structured documentation-gap artifact generation for failed or weak-support runs
- `lib/answer.ts`: chunk-1 grounded answer generation plus chunk-2 mixed-evidence structured claim generation
- `lib/classify.ts`: deterministic routing for docs-only vs docs-plus-tools vs human-review
- `lib/tools/*`: Postgres-backed read-only investigation tools for account context, feature flags, and recent errors
- `lib/ingest.ts` and `lib/investigate.ts`: orchestration boundaries that keep adapters testable and LangGraph-ready later

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

2. Copy `.env.example` to `.env.local` and fill in:

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

The offline eval uses mocked retrieved evidence and tool outputs. It also checks graph-node parity for route and review outcomes. It is useful for validating routing/reporting code, but the live eval is still the real retrieval-quality gate.

The eval runner now reports route correctness, review status, retrieval evidence keywords, tool evidence, and top retrieved docs. It exits non-zero if the grounded behavior drifts.

## Verification

Run these before claiming the slice is ready:

```bash
npm run lint
npm run test
npm run build
npm run eval:demo
```
