# Feature: Support Copilot Agentic Roadmap

## Goal

Evolve Support Copilot from a trust-first RAG workbench into a graph-orchestrated support investigation system without sacrificing citation quality, debuggability, or demo reliability.

## Architecture Overview

The current app should remain deterministic and inspectable while the trust layer is hardened. LangGraph should be introduced only after retrieval quality, claim validation, and eval coverage are strong enough to prove that the graph improves workflow clarity rather than adding agentic theater. The target architecture is a stateful investigation graph with explicit nodes for retrieval, routing, tool execution, claim generation, validation, review policy, and optional human-review interrupts.

## Positioning

This project should be described as:

> A trust-first support investigation copilot that combines RAG, pgvector retrieval, structured outputs, claim-level citation validation, deterministic tool routing, and a LangGraph-ready orchestration path for human-review workflows.

Avoid claiming "multi-agent" until there are genuinely distinct agent responsibilities and testable graph states. Prefer "graph-orchestrated investigation workflow" over "AI agents" in technical discussions.

## Tech Stack

- Next.js App Router
- TypeScript
- Supabase Postgres with pgvector
- OpenAI embeddings and structured outputs
- Vitest for unit/integration tests
- Future: LangGraph for explicit workflow orchestration

## Project Handoff Context

Use this section first if another conversation picks up the project without chat history.

### Current Product State

- The app is a single-root Next.js app, not a monorepo.
- Users can upload `.md`, `.txt`, and best-effort text-based `.pdf` files.
- Uploaded files are parsed on upload; raw files are not intentionally retained.
- Parsed chunks, metadata, and embeddings are stored in Supabase Postgres with pgvector.
- The corpus is session-scoped and currently limited to 3 user-uploaded docs per session.
- The investigation flow retrieves document chunks, classifies the ticket path, generates structured claim-level output, validates citations, and falls back to human review when support is weak.
- Chunk 2 support context exists through seeded account/tool tables, but the preferred UX is not account-first. Account/tool context should be treated as optional structured support context unless a specific demo scenario needs seeded tools.
- The current UI direction is a compact workbench: source docs first, ticket/context second, answer/evidence only after the user has something to inspect.

### Current Architecture Map

- `app/api/upload/route.ts`: upload request handling, ingestion logging, parse/chunk/embed/persist orchestration.
- `app/api/investigate/route.ts`: investigation request handling and response logging.
- `app/api/documents/route.ts`: session document listing and clearing/removal operations.
- `app/page.tsx`: lightweight server entry that renders the client shell without blocking on Supabase calls.
- `components/SupportCopilotShell.tsx`: main workbench layout and client-side state.
- `components/UploadPanel.tsx`: source-doc upload and session doc list.
- `components/TicketForm.tsx`: ticket textarea, optional context, debug controls, investigation trigger.
- `components/AnswerPanel.tsx`: structured customer reply and internal diagnosis rendering.
- `components/EvidencePanel.tsx`: retrieved doc evidence, tool evidence, and tool-call inspection.
- `lib/ingest.ts`: file ingestion boundary.
- `src/server/ingestion/parse.ts`: text extraction for markdown, text, and PDF.
- `lib/chunk.ts`: deterministic chunking.
- `lib/embed.ts`: OpenAI embedding generation.
- `lib/retrieve.ts`: pgvector retrieval.
- `src/server/ai/answer.ts`: structured answer generation and claim validation helpers.
- `lib/classify.ts`: deterministic route selection.
- `src/server/investigation/investigate.ts`: current main orchestration module. This is the biggest refactor target before LangGraph.
- `lib/support-level.ts`: support-level heuristic.
- `lib/review-policy.ts`: review-status policy.
- `lib/tools/*`: read-only seeded support-context tools.
- `lib/db.ts`: Supabase persistence adapter.
- `lib/types/investigation.ts`: chunk-2 structured result contract.

### Current Scripts and Verification

- `npm run dev`: starts Next with webpack. This was chosen because the local Turbopack path was slow/problematic during UI iteration.
- `npm run build`: production build.
- `npm run lint`: ESLint.
- `npm run test`: Vitest suite.
- `npm run typecheck`: TypeScript check.
- `npm run seed:demo`: seeds demo docs and support context.
- `npm run eval:demo`: runs the current seeded eval suite from `demo/evals.json`.

Before claiming a change is complete, run the narrow relevant check plus `npm run lint` when practical. For pipeline changes, run `npm run test` and `npm run eval:demo`. For UI/build config changes, run `npm run build`.

### Existing Demo and Eval Assets

- `demo/docs`: seeded support documentation.
- `demo/tickets.json`: demo tickets.
- `demo/support-context.json`: seeded accounts, flags, and errors.
- `demo/evals.json`: 15 current eval cases covering docs-only, docs-plus-tools, missing account, unsupported, conflict, misleading wording, and needs-human-review cases.
- `scripts/run-evals.ts`: current eval runner. It checks expected mode, review status, minimum doc evidence count, and whether tool evidence is present when required.

### Important Decisions Already Made

- Keep `insufficient_support` as the canonical enum spelling. Do not introduce alternate spellings.
- Preserve structured JSON outputs as the source of truth: `customer_reply_json` and `internal_diagnosis_json`.
- Use `S1`, `S2`, etc. for document evidence and `T1`, `T2`, etc. for tool evidence.
- Do not add LangGraph until the deterministic pipeline is stable and measurable.
- If account/tool evidence is required but missing, return `needs_human_review` rather than blocking the UI.
- Keep retrieval and tool evidence separate in the API and UI.
- Avoid freeform answer blobs. Render customer/internal output from structured claims.
- Treat "agentic" as a later graph-orchestration capability, not a marketing label pasted onto the current pipeline.

### Known Risks

- `src/server/investigation/investigate.ts` is carrying too much orchestration logic. Split evidence building, tool running, and conflict policy before adding LangGraph.
- DB writes are not fully transactional across tickets, investigations, sources, and tool calls.
- The eval suite exists but is still shallow. It checks routing/evidence counts more than answer correctness, retrieval quality, or unsupported-claim coverage.
- Chunking is serviceable but still risky for troubleshooting tables and manual-style PDFs.
- The claim validator checks citation structure, claim length, citation labels, and lightweight evidence overlap. It can reject obvious unsupported citation use, but it does not deeply prove every claim is entailed by excerpts.
- UI polish has improved, but the user is sensitive to wasted space, oversized chips, and redundant status blocks. Keep UI changes compact and evidence-first.

### Next Best Implementation Slice

Do not start with LangGraph. The next best slice is:

1. Improve the eval runner so it reports retrieval quality, route correctness, fallback correctness, and critical failures in readable terminal sections.
2. Add expected-evidence keywords or document hints to `demo/evals.json`.
3. Add table-aware chunking coverage for troubleshooting-table text.
4. Extract `lib/evidence-builder.ts` from `src/server/investigation/investigate.ts`.
5. Extract `lib/tool-runner.ts` from `src/server/investigation/investigate.ts`.
6. Extract `lib/conflict-policy.ts` from `src/server/investigation/investigate.ts`.

Only after those pass should the project introduce a feature-flagged LangGraph runner.

### Batch Progress: 2026-04-27

- Added readable `npm run eval:demo` reporting for routing, review status, retrieval, tool evidence, top retrieved docs, and missing evidence keywords.
- Added broad `expectedEvidenceKeywords` checks to the existing 15-case `demo/evals.json`.
- Added `demo/evals.README.md`.
- Added troubleshooting-table chunking coverage and updated chunking to preserve table-like rows with corrective actions.
- Extracted `lib/evidence-builder.ts` from `src/server/investigation/investigate.ts`.
- Extracted `lib/tool-runner.ts` from `src/server/investigation/investigate.ts`.
- Extracted `lib/conflict-policy.ts` from `src/server/investigation/investigate.ts`.
- Changed investigation schema handling to fail loudly when required migrations are missing.
- Fixed TypeScript 6 `baseUrl` deprecation noise with `ignoreDeprecations`.

Verification from this batch:

- `npm run test` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed with existing warnings about `tailwind.config.ts` module type and Turbopack NFT tracing through `src/server/config/env.ts`.
- `npm run eval:demo` could not reach Supabase in this environment: first sandbox blocked the `tsx` IPC pipe, then escalated execution failed at `createTicket` with `TypeError: fetch failed`.

### Batch Progress: 2026-04-27 Continued

- Added `docs/architecture.md` with the current pipeline, trust model, boundaries, limitations, and LangGraph direction.
- Added `docs/demo-script.md` with a 3-minute interview walkthrough covering docs-only, docs-plus-context, missing-context review, and unsupported fallback paths.
- Linked the architecture and demo script from `README.md`.
- Added MCP future-positioning notes to this roadmap and the chunk 2 PRD. MCP remains out of V1 and is framed as a later controlled-tool interface.
- Made `scripts/run-evals.ts` fail with a clear Supabase/OpenAI environment message instead of raw `fetch failed`.
- Removed the temporary legacy investigation insert path from normal configuration.
- Reduced build fragility:
  - Changed the manual env loader to use a statically scoped project root and Turbopack ignore comment.
  - Made the package explicitly ESM with `"type": "module"`.
  - Renamed `postcss.config.js` to `postcss.config.cjs`.
  - Removed `next/font/google` runtime build dependency and switched to local system font stacks.

Verification from this continuation:

- `npm run test` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed when run outside the sandbox. The sandboxed build hit a Turbopack/PostCSS worker `EPERM` on local process binding.
- `npm run eval:demo` still cannot reach Supabase in this environment and fails at `createTicket` with the new actionable environment message.

### Batch Progress: 2026-04-27 Offline Eval Harness

- Added `npm run eval:demo:offline` for restricted environments where Supabase/OpenAI are not reachable.
- The offline harness uses mocked retrieved evidence and mocked tool outputs. It validates routing, review state, report formatting, evidence keyword checks, and tool-evidence wiring, but it is not a replacement for live retrieval evals.
- Offline eval exposed and fixed two routing bugs:
  - Selected-account plan entitlement questions now route to `docs_plus_tools`.
  - General "hidden blocker" phrasing no longer triggers feature-flag routing.
- Added classifier regression coverage for both cases.

Verification from this continuation:

- `npm run test` passed with 38 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run eval:demo:offline` passed 15/15 outside the sandbox. Inside the sandbox, `tsx` can still fail with an IPC pipe `EPERM`.

### Batch Progress: 2026-04-27 Live Eval Restored

- Restored the `Support Copilot` Supabase project. Root cause of the earlier `fetch failed` was that the project was `INACTIVE`, so the project host did not resolve.
- Applied all repo migrations to the restored project:
  - `support_copilot_chunk_1`
  - `session_scope_and_doc_limit`
  - `support_copilot_chunk_2`
- Ran `npm run seed:demo` successfully:
  - 5 accounts
  - 6 feature flags
  - 3 error events
  - 8 demo docs
  - 24 document chunks
- Lowered local and example `SUPPORT_MATCH_THRESHOLD` to `0.46`, matching the code default. The previous local value `0.58` filtered out relevant audit/payment/Starter/import evidence.
- Adjusted support-level heuristics so usable cited evidence around `0.52+` becomes `low` support instead of automatic `insufficient_support`.
- Added regression coverage for low-but-usable evidence.

Verification from this live run:

- `npm run eval:demo` passed 15/15 against live Supabase/OpenAI.
- `npm run test` passed with 39 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed outside the sandbox.

### Batch Progress: 2026-04-27 Graph State Contract

- Started Phase 2 without changing runtime behavior or adding LangGraph as a dependency.
- Added `lib/experimental/graph/investigation-state.ts` with the typed state object that future graph nodes will pass through.
- Captured request input, retrieved evidence, routing decision, doc/tool evidence, generated claims, grounding validation, review policy, persistence IDs, missing-context state, and conflict state in one contract.
- Added small state helpers for initial state creation and step tracking.
- Added `tests/investigation-state.test.ts` coverage for the empty state, idempotent step recording, and a populated future graph-node state.
- Added deterministic graph-node wrappers for retrieval, classification, context tools/conflict detection, claim generation, citation validation, and review-policy application.
- Added `tests/graph-nodes.test.ts` coverage using stubs, so the graph-node contract is tested without calling Supabase or OpenAI.

Verification from this slice:

- `npm run test -- investigation-state` passed with 3 tests.
- `npm run test -- graph-nodes investigation-state` passed with 6 tests.
- `npm run test` passed with 45 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run eval:demo:offline` passed 15/15.

### Batch Progress: 2026-04-27 Review Loop And Atomic Persistence

- Added a visible human-review queue state with deterministic next-action guidance.
- Added a staged retry state so the demo path reads as review blocked -> add context -> rerun investigation.
- Added a local "mark reviewed" action for interview walkthroughs.
- Added `getReviewAction` coverage for missing context, missing docs, conflict gaps, and ready investigations.
- Added `create_investigation_run` migration so ticket, investigation, source links, and tool-call rows can be written in one database transaction.
- Moved investigation orchestration to a single persistence boundary when the atomic adapter is available, with a compatibility path for older schemas/tests.

Verification from this slice:

- `npm run test -- review-actions` passed with 4 tests.
- `npm run test -- investigate-structured` passed with 5 tests.

### Batch Progress: 2026-04-27 Graph Parity Eval

- Extended the offline eval harness to run each case through the direct investigation pipeline and the graph-node pipeline.
- Added graph parity reporting for mode and review status before wiring any graph runtime path.
- Kept parity offline-only so it stays deterministic and does not double-call live Supabase/OpenAI dependencies.

Verification from this slice:

- `npm run eval:demo:offline` passed 15/15 with graph parity 15/15.

### Batch Progress: 2026-04-27 Citation Grounding Guard

- Added a lightweight claim/evidence overlap check to structured answer validation.
- Claims with known citations can still be rejected when the cited excerpts share no meaningful terms with the claim text.
- Added regression coverage for unsupported citation attachment.
- Applied the atomic persistence migration to the live Supabase project and reran live eval successfully.
- Added a public API hardening migration after Supabase advisors flagged exposed public tables and executable `SECURITY DEFINER` RPCs.
- Locked database access to server-side service-role adapters by enabling RLS, revoking public table grants, revoking public RPC execution, dropping the stale retrieval function overload, and adding missing foreign-key indexes.

Verification from this slice:

- `npm run test -- investigation-answer` passed with 3 tests.
- `npm run test` passed with 51 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run eval:demo:offline` passed 15/15 with graph parity 15/15.
- `npm run eval:demo` passed 15/15 against live Supabase/OpenAI after applying the atomic persistence migration.
- Supabase function privilege check confirmed `anon=false`, `authenticated=false`, and `service_role=true` for `create_investigation_run` and `match_document_chunks`.
- Supabase security advisors now report only `RLS Enabled No Policy` info notices for the service-role-only tables.

## Non-Goals

- Do not add LangChain chains just for keywords.
- Do not replace working retrieval/answer code with opaque abstractions.
- Do not add multi-agent prompts before the eval suite can detect regressions.
- Do not add external Slack/Zendesk integrations in this phase.
- Do not add MCP before the core workflow is stable and evaluated.

## Future MCP Positioning

MCP is a V2/V3 interface layer, not a V1 requirement. Keep the first product as a normal Next.js/Supabase application with explicit APIs, deterministic routing, structured outputs, and eval coverage.

For Support Copilot, a future MCP server could expose controlled tools for AI-assisted review:

- `analyze_case`
- `get_retrieved_evidence`
- `get_support_findings`
- `create_review_task`
- `mark_task_verified`

Write actions should remain gated behind explicit user confirmation. The interview framing should be:

> I intentionally kept V1 as a normal product. Once the core workflow is stable, MCP becomes a clean interface layer for agents to inspect evidence, query summaries, and assist review decisions through controlled tools.

For adjacent portfolio projects, MCP is strongest where the workflow is already inspect -> queue -> verify. StackHunt/site improvement is the cleanest fit: `analyze_page`, `get_seo_findings`, `create_improvement_task`, `mark_task_verified`, and `get_page_evidence`. For a finance ingest/review project, keep V1 without MCP and list V2 as read-only finance review and summary tools, with any write action gated by explicit confirmation.

## Target Graph Shape

```text
Start
  -> RetrieveDocumentation
  -> ClassifyInvestigation
  -> DecideContextNeeds
  -> RunContextTools?
  -> BuildEvidenceRegistry
  -> GenerateClaimDraft
  -> ValidateGrounding
  -> ComputeSupportAndReviewPolicy
  -> HumanReviewInterrupt?
  -> PersistInvestigation
  -> ReturnInvestigationResult
```

## Phase 0: Stabilize Current Trust Layer

### Task 1: Add canonical eval manifest

**Files:**

- Modify `demo/evals.json`
- Create `demo/evals.README.md` if evaluator guidance grows beyond the README

**Action:** The repo already has 15 seeded eval cases in `demo/evals.json`. Extend them before changing orchestration. Add expected evidence hints or keywords so the eval runner can detect retrieval quality, not just route shape. Include docs-only, multi-doc, unsupported, noisy query, provided-context, missing-context, conflict, and tool-assisted cases.

**Case shape:**

```json
{
  "id": "exports-permission-docs-only",
  "ticket": "Our export keeps failing after setup. What should we check first?",
  "expectedMode": "docs_only",
  "expectedSupportLevels": ["high", "medium"],
  "expectedEvidence": ["exports", "permissions"],
  "mustFallback": false
}
```

**Verify:**

```bash
npm run eval:demo
```

**Commit:** `test(evals): strengthen canonical support investigation cases`

---

### Task 2: Add eval runner

**Files:**

- Modify `scripts/run-evals.ts`
- Modify `package.json`

**Action:** The repo already has `scripts/run-evals.ts` and `npm run eval:demo`. Improve the runner so it records retrieval/routing/support/fallback results with readable summaries instead of only dumping JSON.

**Current script:**

```json
"eval:demo": "tsx scripts/run-evals.ts"
```

**Verify:**

```bash
npm run eval:demo
```

**Commit:** `test(evals): improve support copilot eval runner`

---

### Task 3: Add retrieval quality reporting

**Files:**

- Modify `scripts/run-evals.ts`
- Modify `evals/README.md`

**Action:** Report top-k retrieval hits, missing expected evidence, fallback correctness, and route correctness. Keep this simple and terminal-readable.

**Expected output sections:**

```text
Retrieval: 14/18 passed
Routing: 16/18 passed
Fallback: 17/18 passed
Critical failures:
- compressor-oil-usage: expected troubleshooting table evidence not retrieved
```

**Verify:**

```bash
npm run eval:demo
```

**Commit:** `test(evals): report retrieval and routing quality`

---

### Task 4: Add table-aware chunking tests

**Files:**

- Modify `tests/chunk.test.ts`
- Modify `lib/chunk.ts`

**Action:** Add a failing test using troubleshooting-table style text, then update chunking so cause/action rows remain in the same retrievable chunk.

**Verify RED/GREEN:**

```bash
npm run test -- chunk
```

**Commit:** `fix(chunking): preserve troubleshooting table context`

---

## Phase 1: Split Pipeline Policies Before LangGraph

### Task 5: Extract evidence builder

**Files:**

- Create `lib/evidence-builder.ts`
- Modify `src/server/investigation/investigate.ts`
- Create `tests/evidence-builder.test.ts`

**Action:** Move doc evidence mapping, tool evidence mapping, and citation ID registry construction out of `src/server/investigation/investigate.ts`.

**Verify:**

```bash
npm run test -- evidence-builder investigate
```

**Commit:** `refactor(investigate): extract evidence builder`

---

### Task 6: Extract tool runner

**Files:**

- Create `lib/tool-runner.ts`
- Modify `src/server/investigation/investigate.ts`
- Create `tests/tool-runner.test.ts`

**Action:** Move `collectToolArtifacts` and tool-call record construction into a dedicated module. Keep tools read-only and deterministic.

**Verify:**

```bash
npm run test -- tool-runner investigate
```

**Commit:** `refactor(investigate): extract deterministic tool runner`

---

### Task 7: Extract conflict policy

**Files:**

- Create `lib/conflict-policy.ts`
- Modify `src/server/investigation/investigate.ts`
- Create `tests/conflict-policy.test.ts`

**Action:** Move conflict detection out of orchestration and add cases for "tool state explains issue" vs "tool state does not explain issue."

**Verify:**

```bash
npm run test -- conflict-policy investigate
```

**Commit:** `refactor(policy): isolate conflict detection`

---

### Task 8: Remove silent legacy investigation fallback

**Files:**

- Modify `lib/db.ts`
- Modify `README.md`

**Action:** Replace silent schema fallback with explicit failure or environment-gated compatibility mode.

**Implementation rule:**

- Default: fail loudly if structured columns are missing.
- Optional fallback was removed; investigations now require the atomic persistence path.

**Verify:**

```bash
npm run test -- investigate
npm run build
```

**Commit:** `fix(data): fail loudly on missing investigation v2 schema`

---

## Phase 2: Introduce LangGraph as Orchestration, Not Magic

### Task 9: Add graph state types

**Files:**

- Create `lib/experimental/graph/investigation-state.ts`
- Create `tests/investigation-state.test.ts`

**Action:** Define the state object that moves through graph nodes. It should include ticket, session, retrieved evidence, routing decision, tool evidence, draft claims, validation result, support level, review status, and persistence IDs.

**Verify:**

```bash
npm run test -- investigation-state
```

**Commit:** `feat(graph): define investigation graph state`

---

### Task 10: Wrap existing functions as graph nodes

**Files:**

- Create `lib/experimental/graph/nodes/retrieve-documentation.ts`
- Create `lib/experimental/graph/nodes/classify-investigation.ts`
- Create `lib/experimental/graph/nodes/run-context-tools.ts`
- Create `lib/experimental/graph/nodes/generate-claims.ts`
- Create `lib/experimental/graph/nodes/validate-grounding.ts`
- Create `lib/experimental/graph/nodes/apply-review-policy.ts`
- Create `tests/graph-nodes.test.ts`

**Action:** Wrap existing deterministic modules as isolated graph nodes. Do not change behavior yet.

**Verify:**

```bash
npm run test -- graph-nodes
```

**Commit:** `feat(graph): wrap investigation pipeline as graph nodes`

---

### Task 11: Add graph runner behind feature flag

**Files:**

- Create `lib/experimental/graph/investigation-graph.ts`
- Modify `src/server/investigation/investigate.ts`
- Modify `.env.example`

**Action:** Add `SUPPORT_USE_LANGGRAPH=true` to run the graph path. Default remains the current direct pipeline until evals prove parity.

**Verify:**

```bash
npm run test -- investigate graph
SUPPORT_USE_LANGGRAPH=true npm run test -- investigate graph
```

**Commit:** `feat(graph): add feature-flagged investigation graph runner`

---

### Task 12: Prove graph parity with evals

**Files:**

- Modify `scripts/run-evals.ts`
- Modify `evals/README.md`

**Action:** Run every eval case against both direct pipeline and graph pipeline. Report parity failures.

**Verify:**

```bash
npm run eval
SUPPORT_USE_LANGGRAPH=true npm run eval
```

**Commit:** `test(graph): add graph parity evals`

---

## Phase 3: Add One Real Agentic Capability

### Task 13: Add human-review interrupt state

**Files:**

- Modify `lib/experimental/graph/investigation-state.ts`
- Modify `lib/experimental/graph/investigation-graph.ts`
- Modify `components/AnswerPanel.tsx`
- Modify `components/EvidencePanel.tsx`

**Action:** When validation fails, evidence conflicts, or required context is missing, stop in a human-review state and expose exactly what input would unblock the investigation.

**Verify:**

```bash
npm run test -- graph
npm run build
```

**Commit:** `feat(graph): add human review interrupt state`

---

### Task 14: Add rerun-from-review path

**Files:**

- Modify `app/api/investigate/route.ts`
- Modify `components/TicketForm.tsx`
- Modify `lib/experimental/graph/investigation-graph.ts`

**Action:** Let the user add missing context and rerun the investigation from the review state. Keep this local to the app; do not add external workflow integrations.

**Verify:**

```bash
npm run test
npm run build
```

**Commit:** `feat(graph): rerun investigation from review context`

---

## Phase 4: Portfolio Packaging

### Task 15: Add architecture doc

**Files:**

- Create `docs/architecture.md`

**Status:** Done in batch progress on 2026-04-27.

**Action:** Explain the system in one page: ingestion, retrieval, structured generation, validation, tool evidence, review policy, and graph orchestration.

**Verify:**

```bash
npm run lint
```

**Commit:** `docs(architecture): document support copilot pipeline`

---

### Task 16: Add interview demo script

**Files:**

- Create `docs/demo-script.md`

**Status:** Done in batch progress on 2026-04-27.

**Action:** Add a 3-minute demo script with three paths: docs-only, docs-plus-context, and needs-human-review.

**Verify:**

```bash
npm run lint
```

**Commit:** `docs(demo): add interview walkthrough script`

---

### Task 17: Update README positioning

**Files:**

- Modify `README.md`

**Action:** Position the project as a trust-first RAG support investigation system with an optional LangGraph orchestration path. Include setup, evals, and demo script links.

**Verify:**

```bash
npm run build
```

**Commit:** `docs(readme): position project for portfolio review`

## Checkpoints

### Checkpoint A: Before LangGraph

Required before Phase 2:

- `npm run test` passes
- `npm run build` passes
- `npm run eval` exists
- eval suite has at least 15 cases
- table-style troubleshooting docs retrieve expected chunks

### Checkpoint B: Before calling it agentic

Required before portfolio claims:

- graph path passes eval parity against direct path
- human-review interrupt is real and visible
- graph nodes are independently tested
- README explains why graph orchestration exists

## Recommended Resume Framing

Use this after Phase 1:

```latex
\resumeItem{Built a trust-first support investigation assistant with doc ingestion, pgvector retrieval, OpenAI structured outputs, claim-level citation validation, deterministic tool routing, and explicit insufficient-support fallback behavior.}
```

Use this after Phase 2 or 3:

```latex
\resumeItem{Refactored the investigation pipeline into a LangGraph-style stateful workflow with retrieval, routing, tool execution, claim validation, support scoring, and human-review interrupts while preserving eval parity with the deterministic pipeline.}
```
