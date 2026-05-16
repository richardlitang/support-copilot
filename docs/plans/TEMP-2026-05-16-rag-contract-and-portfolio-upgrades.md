# TEMP: RAG Contract And Portfolio Upgrades

## Purpose

This is the working plan for the next portfolio-quality pass. It combines the remaining CTO/principal review backlog with the newer decision to prioritize deterministic RAG contract evals over free AI code reviewers.

The target story is:

> Support Copilot is a RAG support system where answers are tested, grounded, citation-validated, and routed to human review when evidence is weak.

AI PR review can be added later as a non-blocking second pass, but it is not the main quality signal.

## Operating Principles

- Product correctness comes from deterministic tests, evals, and typed contracts.
- AI review may comment, but it must not replace CI gates or human architectural judgment.
- User-facing UI should say "Answer Quality", "Grounding Check", or "Evidence Check", not "evals".
- Avoid vague confidence scores unless they are calibrated. Prefer readiness and concrete grounding signals.
- Keep each slice shippable, verified, and committed independently.

## Priority Order

1. Formalize existing evals into a first-class RAG contract gate.
2. Add compact Answer Quality / Grounding Check metadata and UI.
3. Add durable ingestion job state with `document_ingestion_jobs`.
4. Retire legacy-looking persistence facades and unused exports.
5. Split the largest remaining files into reader-friendly modules.
6. Expand security/privacy eval coverage.
7. Optionally add one non-blocking AI PR reviewer with a narrow repo-specific prompt.

## Slice 1: RAG Contract Gate

### Goal

Turn the current offline eval path into a named product contract that runs in `npm run verify`.

### Tasks

- Add `npm run eval:rag-contract` as the canonical deterministic RAG gate.
- Keep `eval:demo:offline` as an alias or migrate docs/scripts cleanly.
- Update `npm run verify` to call `eval:rag-contract`.
- Update `docs/evals.md` to describe the contract as a release gate, not only a demo eval.
- Make the eval output language match the contract:
  - routing
  - retrieval
  - review decision
  - citation validity
  - grounded claim behavior
  - graph/direct parity

### Blocking Checks

- Expected sources appear for known cases.
- Missing-doc questions route to human review or insufficient support.
- Claims include valid citations.
- Weak or unsupported evidence maps to `needs_human_review`.
- Graph wrapper and direct path keep equivalent review behavior.

### Verify

```bash
npm run eval:rag-contract
npm run verify
```

### Commit

`chore(evals): formalize rag contract gate`

## Slice 2: Add Golden RAG Contract Cases

### Goal

Add a small, readable golden set that proves the support-specific behavior the app claims to provide.

### Candidate Cases

1. Known export failure:
   - expected source: export troubleshooting evidence
   - expected status: `ready`
   - expected behavior: cited customer and internal claims
2. 80,000-row CSV import stalled:
   - expected source: import or row-limit evidence
   - expected behavior: async/import explanation is grounded
3. Missing-doc question:
   - expected status: `needs_human_review`
   - expected behavior: no confident unsupported answer
4. Failed document exclusion:
   - expected behavior: failed docs are not used as evidence
5. Processing document exclusion:
   - expected behavior: processing docs are not used as evidence
6. Unsupported claim case:
   - expected behavior: unsupported or invalid claims trigger review
7. Graph vs direct parity:
   - expected behavior: same review status and required evidence behavior

### Verify

```bash
npm run eval:rag-contract
npm run test
```

### Commit

`test(evals): expand rag contract cases`

## Slice 3: Answer Quality Contract

### Goal

Add explicit answer-quality metadata to investigation results without pretending to have calibrated confidence.

### Preferred Shape

```ts
type AnswerQualityCheck = {
  retrieval: {
    sourceCount: number;
    topK: number;
    ignoredDocStatuses: Array<"uploaded" | "processing" | "failed">;
  };
  grounding: {
    totalClaims: number;
    supportedClaims: number;
    weakClaims: number;
    unsupportedClaims: number;
    invalidCitations: number;
  };
  readiness: {
    status: "ready" | "needs_human_review" | "blocked";
    reasons: string[];
  };
  missingInfo: {
    hasDocsGap: boolean;
    missingItems: string[];
  };
};
```

### Tasks

- Add the type near `InvestigationResult`.
- Derive quality metadata from existing review status, docs gap report, evidence, and claim validation.
- Keep initial scoring deterministic and explainable.
- Avoid a `confidence: high | medium | low` field for now.
- Include the metadata in API responses and saved investigation results if persistence already supports it cleanly.

### Verify

```bash
npm run typecheck
npm run test
npm run eval:rag-contract
```

### Commit

`feat(investigation): add answer quality metadata`

## Slice 4: Compact Answer Quality UI

### Goal

Show trust evidence in the product without adding a heavyweight dashboard.

### UI Behavior

Normal mode:

- Status: `Ready`, `Needs human review`, or `Blocked`
- Evidence used count
- Claims checked count
- Unsupported or invalid claim count
- Missing information summary when available

Debug mode:

- Retrieval details
- Grounding counts
- Readiness reasons
- Docs gap details

### Candidate Location

- Reuse or sit near the existing answer/evidence area.
- Prefer a compact `Answer Quality` or `Grounding Check` component.

### Verify

```bash
npm run lint
npm run typecheck
npm run build
```

### Commit

`feat(ui): surface answer quality check`

## Slice 5: Durable Document Ingestion Jobs

### Goal

Upgrade ingestion from queue-backed MVP state to durable, auditable job state.

### Preferred Table

```text
document_ingestion_jobs
- id
- document_id
- queue_job_id
- status: queued | processing | completed | failed | cancelled
- attempt_count
- max_attempts
- locked_at
- worker_id
- last_error_code
- last_error_message_safe
- started_at
- completed_at
- created_at
- updated_at
```

### Tasks

- Add a Supabase migration.
- Add a focused repository module under `src/server/db`.
- Create the job row during upload before enqueue completes.
- Pass `ingestionJobId` in the BullMQ payload.
- Update job lifecycle in the worker.
- Keep `documents.status` as the product-facing document state.
- Use the job table for operational traceability and retry/failure history.

### Verify

```bash
npm run typecheck
npm run test
npm run verify
```

### Commit

`feat(ingestion): persist document ingestion jobs`

## Slice 6: Retire Legacy-Looking Persistence Facade

### Goal

Make server persistence imports read like deliberate architecture instead of historical accumulation.

### Tasks

- Audit `lib/db.ts` exports.
- Remove unused old exports if local search confirms no runtime or test callers:
  - `createTicket`
  - `createInvestigation`
  - `insertInvestigationSources`
  - `insertInvestigationToolCalls`
- Move remaining safe wrappers to focused modules or convert `lib/db.ts` into a pure compatibility barrel.
- Update callers to import from `src/server/db/*` where appropriate.

### Verify

```bash
npm run typecheck
npm run test
npm run verify
```

### Commit

`refactor(db): remove legacy persistence facade`

## Slice 7: Split Evaluation Runner

### Goal

Make the eval system easier to inspect as a portfolio artifact.

### Tasks

- Split `scripts/run-evals.ts` into smaller modules:
  - eval cases
  - offline fixtures/evidence
  - assertions
  - graph parity
  - CLI runner
- Keep CLI behavior and output stable while splitting.
- Update file-health budgets if needed.

### Verify

```bash
npm run eval:rag-contract
npm run typecheck
npm run verify
```

### Commit

`refactor(evals): split rag contract runner`

## Slice 8: Split Large UI Surfaces

### Goal

Improve human readability for reviewers opening the frontend for the first time.

### Candidate Files

- `components/AnswerPanel.tsx`
- `components/TicketForm.tsx`
- `components/SupportCopilotShell.tsx`
- `components/UploadPanel.tsx`

### Tasks

- Extract components only where the names reveal product concepts.
- Avoid churny styling rewrites.
- Keep normal and debug paths easy to follow.
- Add file-health budgets once files are split.

### Verify

```bash
npm run lint
npm run typecheck
npm run build
```

### Commit

`refactor(ui): split support workflow components`

## Slice 9: Security And Privacy Eval Coverage

### Goal

Turn the threat model into runnable regression checks.

### Candidate Cases

- Prompt injection inside uploaded docs is treated as untrusted content.
- PII or raw internal tool output is not leaked into customer-facing claims.
- Unsupported security/compliance claims route to human review.
- Error messages remain safe and do not expose secrets.

### Verify

```bash
npm run eval:rag-contract
npm run test
```

### Commit

`test(evals): add security rag contract cases`

## Slice 10: Optional Non-Blocking AI PR Reviewer

### Goal

Use AI review as a second-pass comment bot, not as a correctness gate.

### Requirements

- Non-blocking.
- One reviewer only.
- Narrow prompt focused on Support Copilot risks:
  - async ingestion state transitions
  - BullMQ retry/idempotency
  - unsafe exposure of uploaded content
  - unsupported RAG claims
  - missing failure-path tests
  - overly broad API responses
  - privacy/security risks

### Do Not

- Add multiple noisy free reviewers.
- Let AI review block deterministic CI.
- Market this as the main quality signal.

### Commit

`ci: add non-blocking ai review comments`

## README Positioning

When the RAG contract and UI quality panel are done, update the README with language like:

> Support Copilot includes deterministic RAG regression checks that run in CI. The eval suite verifies that expected sources are retrieved, non-ready documents are excluded, generated claims include valid citations, missing-document questions do not produce confident answers, unsupported claims route to human review, and direct/graph investigation paths remain behaviorally equivalent.
>
> Each investigation returns answer-quality metadata used by the UI to show review status, evidence coverage, unsupported claims, and missing information.

## Current Status

- [ ] Slice 1: RAG contract gate
- [ ] Slice 2: Golden RAG contract cases
- [ ] Slice 3: Answer quality contract
- [ ] Slice 4: Compact Answer Quality UI
- [ ] Slice 5: Durable document ingestion jobs
- [ ] Slice 6: Persistence facade cleanup
- [ ] Slice 7: Eval runner split
- [ ] Slice 8: Large UI surface split
- [ ] Slice 9: Security and privacy evals
- [ ] Slice 10: Optional AI PR reviewer
