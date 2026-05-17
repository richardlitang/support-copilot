# Feature: Support Copilot Chunk 2

## Goal

Extend the existing grounded RAG app into a trust-preserving support investigation workflow that combines documentation evidence with seeded account/product context and explicit human-review routing.

## Architecture Overview

Chunk 2 is additive. The existing doc retrieval pipeline remains intact, while a structured investigation contract layers on top with deterministic routing, Postgres-backed read-only tools, mixed-citation validation, and separate customer/internal outputs. The UI stays thin and the backend remains modular.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres with pgvector
- OpenAI for embeddings and structured answer generation
- Vitest for unit and integration coverage

## Future MCP Extension

Do not add MCP in chunk 2. The priority is still the core support investigation product: upload docs, retrieve evidence, combine optional structured context, validate cited claims, and route weak cases to human review.

MCP is a strong V2 fit once the workflow is stable because this product already has natural tool boundaries:

- `analyze_case`
- `get_retrieved_evidence`
- `get_support_findings`
- `create_review_task`
- `mark_task_verified`

The senior framing is: "V1 is a normal Next.js/Supabase product with explicit APIs and deterministic trust policies. V2 can expose selected read-only review and evidence tools through MCP so AI agents can inspect cases and assist review decisions through controlled interfaces. Any write actions should stay gated behind explicit user confirmation."

Related portfolio note: this same MCP shape is especially natural for a StackHunt/site-improvement agent because that workflow is already inspect page -> create issue -> queue fix -> verify result. A future MCP server could expose `analyze_page`, `get_seo_findings`, `create_improvement_task`, `mark_task_verified`, and `get_page_evidence`.

## Tasks

### Task 1: Add chunk-2 plan and structured investigation type boundary

**Files:**

- Create `docs/plans/2026-04-15-support-copilot-chunk-2.md`
- Create `lib/types/investigation.ts`
- Modify `lib/types.ts`

**Action:** Document the additive architecture and introduce dedicated v2 investigation types so chunk-1 answer types are not overloaded.

**Verify:**

```bash
npm run test -- answer
```

**Commit:** `feat(plan): define chunk-2 investigation v2 contract`

### Task 2: Add schema for seeded support context and structured investigation outputs

**Files:**

- Create `supabase/migrations/*chunk_2*.sql`
- Modify `lib/db.ts`

**Action:** Add nullable structured investigation columns, support-context tables, and investigation tool call persistence while keeping existing markdown/status fields intact.

**Verify:**

```bash
npm run test -- investigate
```

**Commit:** `feat(data): add chunk-2 support context schema`

### Task 3: Implement deterministic routing and Postgres-backed tools

**Files:**

- Create `lib/classify.ts`
- Create `lib/tools/account-context.ts`
- Create `lib/tools/feature-flags.ts`
- Create `lib/tools/recent-errors.ts`
- Create `lib/support-level.ts`
- Create `lib/review-policy.ts`

**Action:** Add pure routing, dedicated support heuristics, and read-only tool modules that query seeded data rather than in-memory fixtures.

**Verify:**

```bash
npm run test -- classify
```

**Commit:** `feat(investigate): add deterministic routing and tool modules`

### Task 4: Extend answer generation and investigation orchestration for mixed evidence

**Files:**

- Modify `src/server/ai/answer.ts`
- Modify `src/server/investigation/investigate.ts`
- Modify `app/api/investigate/route.ts`

**Action:** Produce `InvestigationResult`, validate structured claims against both doc and tool citations, persist structured JSON outputs, and map docs-only runs into the new contract.

**Verify:**

```bash
npm run test -- answer
npm run test -- investigate
```

**Commit:** `feat(answer): add mixed-evidence investigation pipeline`

### Task 5: Update UI for account-aware investigation and separate evidence classes

**Files:**

- Modify `app/page.tsx`
- Modify `components/SupportCopilotShell.tsx`
- Modify `components/TicketForm.tsx`
- Modify `components/AnswerPanel.tsx`
- Modify `components/EvidencePanel.tsx`

**Action:** Add seeded account selection, render customer and internal structured claim sets with citations, and clearly separate document evidence, tool evidence, tool calls, and routing reason.

**Verify:**

```bash
npm run lint
```

**Commit:** `feat(ui): surface tool-augmented investigation state`

### Task 6: Seed demo support context, extend eval inputs, and add tests

**Files:**

- Modify `scripts/seed-demo.ts`
- Modify `scripts/run-evals.ts`
- Modify `demo/*`
- Create/modify `tests/*`
- Modify `README.md`

**Action:** Seed accounts, feature flags, and errors in Postgres, expand demo/eval scenarios for docs-only, docs-plus-tools, missing-account, and conflict cases, and document the new flow.

**Verify:**

```bash
npm run test
npm run build
```

**Commit:** `feat(demo): add chunk-2 seed data and coverage`
