# Feature: Support Copilot Chunk 1

## Goal

Build a single-app Next.js demo that ingests support documents into Supabase/Postgres with pgvector and answers pasted tickets using grounded retrieval with visible evidence.

## Architecture Overview

The app stays in one Next.js root project. Server-side modules handle parsing, chunking, embedding, retrieval, and answer generation behind Route Handlers so the UI stays thin and LangGraph can be added later without rewriting core logic.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres with pgvector
- OpenAI for embeddings and structured answer generation
- Vitest for unit coverage

## Tasks

### Task 1: Scaffold root app and developer tooling

**Files:**

- Create root `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind/PostCSS config, lint/test scripts
- Create `app/`, `components/`, `lib/`, `supabase/`, `public/`

**Action:** Create the base Next.js application structure and scripts so the app boots before feature work begins.

**Verify:**

```bash
npm run lint
npm run test
```

**Commit:** `feat(app): scaffold support copilot root app`

### Task 2: Add schema and server data access

**Files:**

- Create `supabase/migrations/*`
- Create `lib/db.ts`
- Create `lib/types.ts`

**Action:** Define the chunking and investigation tables, pgvector search function, and typed server helpers.

**Verify:**

```bash
npm run test -- schema
```

**Commit:** `feat(data): add support copilot schema and db helpers`

### Task 3: Implement ingestion pipeline

**Files:**

- Create `lib/parse.ts`
- Create `lib/chunk.ts`
- Create `lib/embed.ts`
- Create `app/api/upload/route.ts`

**Action:** Parse `.md`, `.txt`, and best-effort `.pdf` files, split into retrieval chunks, generate embeddings, and persist documents plus chunks.

**Verify:**

```bash
npm run test -- upload
```

**Commit:** `feat(ingest): add document parsing and embedding pipeline`

### Task 4: Implement retrieval and grounded answering

**Files:**

- Create `lib/retrieve.ts`
- Create `lib/citations.ts`
- Create `src/server/ai/answer.ts`
- Create `app/api/investigate/route.ts`

**Action:** Embed the ticket, fetch top chunks, compute heuristic support, and generate structured grounded answers with citations or an insufficient-support fallback.

**Verify:**

```bash
npm run test -- investigate
```

**Commit:** `feat(rag): add retrieval and grounded answer flow`

### Task 5: Build demo UI

**Files:**

- Create `app/page.tsx`
- Create `components/UploadPanel.tsx`
- Create `components/TicketForm.tsx`
- Create `components/AnswerPanel.tsx`
- Create `components/EvidencePanel.tsx`

**Action:** Build the three-panel demo UX, loading and empty states, and debug-only RAG toggle.

**Verify:**

```bash
npm run lint
```

**Commit:** `feat(ui): add support copilot investigation interface`

### Task 6: Seed data, tests, docs, and verification

**Files:**

- Create `supabase/seed.sql`
- Create `tests/*`
- Create `README.md`
- Create `.env.example`

**Action:** Add a small demo corpus, regression tests, setup documentation, and run build/test verification.

**Verify:**

```bash
npm run lint
npm run test
npm run build
```

**Commit:** `feat(demo): add seed data, docs, and verification coverage`
