# Readability And Architecture Hardening

## Goal

Make the repository read like a deliberate portfolio-quality system: clear boundaries, smaller human-readable files, consistent conventions, and automated checks that prevent architectural drift.

## Architecture Overview

The current runtime stays intact while the code is split along stable boundaries. The target shape is `app/` for routes, `components/` for presentation, `lib/` or `core/` for product logic, and `src/server/` for infrastructure adapters. Tooling should enforce dependency direction before the large refactors begin.

## Current Tooling Assessment

- `npm run lint` passes after repairing the local `node_modules` install.
- `npm run format:check` passes.
- `.prettierrc.json` is acceptable as-is: 100-column width, semicolons, double quotes, trailing commas, LF endings.
- ESLint is too light for the next phase. It catches framework issues but does not yet enforce architecture, readability budgets, or server/client import boundaries.
- Do not add global `max-lines` or `complexity` gates yet. They would fail on known legacy-large files before the repo has been split.

## Tasks

### Task 1: Add A Single Verification Entry Point

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Action:**

- Add `npm run verify` that runs:
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run eval:demo:offline`
  - `npm run build`
- Update CI to call the same script where practical, or keep explicit steps and add one local verification script for contributors.

**Verify:**

```bash
npm run verify
```

**Commit:** `chore(tooling): add unified verification script`

---

### Task 2: Add Initial Import Boundary Rules

**Files:**

- Modify: `eslint.config.mjs`

**Action:**

- Add scoped `no-restricted-imports` rules:
  - `components/**` must not import from `@/src/server/**`.
  - `components/**` must not import from API route files.
  - `lib/experimental/graph/**` must not import UI or route modules.
  - `src/server/**` must not import React components.
- Keep the first rules narrow enough that they pass immediately.

**Verify:**

```bash
npm run lint
```

**Commit:** `chore(lint): enforce initial import boundaries`

---

### Task 3: Split Database Access Into Repositories

**Files:**

- Modify: `lib/db.ts`
- Create/modify: `src/server/db/documents.ts`
- Create/modify: `src/server/db/chunks.ts`
- Create/modify: `src/server/db/investigations.ts`
- Create/modify: `src/server/db/supportContext.ts`
- Create/modify: `src/server/db/health.ts`

**Action:**

- Keep `lib/db.ts` as a temporary facade.
- Move document CRUD, chunk matching, investigation persistence, and support-context queries into focused repository modules.
- Update callers one group at a time.

**Verify:**

```bash
npm run typecheck
npm run test
```

**Commit:** `refactor(db): split persistence into focused repositories`

---

### Task 4: Split Answer Generation Into AI Modules

**Files:**

- Modify: `src/server/ai/answer.ts`
- Create: `lib/ai/schemas.ts`
- Create: `lib/ai/prompts.ts`
- Create: `lib/ai/grounded-answer.ts`
- Create: `lib/ai/investigation-answer.ts`
- Create: `lib/ai/fallbacks.ts`

**Action:**

- Move schemas first.
- Move prompt builders second.
- Move fallback/normalization logic third.
- Leave exported behavior unchanged.

**Verify:**

```bash
npm run test -- tests/answer.test.ts tests/investigation-answer.test.ts
npm run typecheck
```

**Commit:** `refactor(ai): split answer generation modules`

---

### Task 5: Turn Investigation Into A Named Pipeline

**Files:**

- Modify: `src/server/investigation/investigate.ts`
- Create: `src/server/investigation/retrieve-evidence.ts`
- Create: `src/server/investigation/collect-context.ts`
- Create: `src/server/investigation/detect-conflicts.ts`
- Create: `src/server/investigation/apply-review.ts`
- Create: `src/server/investigation/persist-run.ts`

**Action:**

- Keep the public investigation API stable.
- Move each stage behind a named function with typed inputs and outputs.
- Make the top-level function read like the product workflow.

**Verify:**

```bash
npm run test -- tests/investigate.integration.test.ts tests/investigate-structured.integration.test.ts
npm run eval:demo:offline
npm run typecheck
```

**Commit:** `refactor(investigation): split pipeline stages`

---

### Task 6: Split The Answer UI Into Reader-Friendly Components

**Files:**

- Modify: `components/AnswerPanel.tsx`
- Create: `components/answer/SourcePreview.tsx`
- Create: `components/answer/CitationMarker.tsx`
- Create: `components/answer/SourceLedger.tsx`
- Create: `components/answer/DocsGapReportCard.tsx`
- Create: `components/answer/PipelineTrace.tsx`

**Action:**

- Extract pure formatting helpers first.
- Extract source/citation display next.
- Extract review and trace sections last.
- Keep visual output unchanged unless a readability issue is obvious.

**Verify:**

```bash
npm run lint
npm run typecheck
npm run build
```

**Commit:** `refactor(ui): split answer panel components`

---

### Task 7: Decide The Graph Boundary

**Files:**

- Modify/move: `lib/experimental/graph/**`
- Modify: `docs/code-map.md`
- Modify: `docs/architecture.md`

**Action:**

- Pick one:
  - Move graph code to `experimental/graph/**`.
  - Or formalize `SUPPORT_PIPELINE=direct|graph` with parity tests.
- Update docs so reviewers know whether graph code is runtime or experimental.

**Verify:**

```bash
npm run test -- tests/graph-nodes.test.ts tests/investigation-state.test.ts
npm run typecheck
```

**Commit:** `refactor(graph): clarify graph pipeline boundary`

---

### Task 8: Reorganize Tests Around Product Capabilities

**Files:**

- Move/modify: `tests/**`
- Modify: `vitest.config.ts` only if paths require it.

**Action:**

- Group tests by capability:
  - `tests/core/**`
  - `tests/retrieval/**`
  - `tests/investigation/**`
  - `tests/ai/**`
  - `tests/infrastructure/**`
- Preserve test names and assertions during the move.

**Verify:**

```bash
npm run test
```

**Commit:** `test: organize tests by product capability`

---

### Task 9: Add Readability Budgets After Refactors

**Files:**

- Modify: `eslint.config.mjs`
- Optionally create: `scripts/check-file-health.ts`

**Action:**

- After large files are split, add enforceable limits:
  - Prefer warning-free lint.
  - Cap React component files.
  - Cap function length for new core/application modules.
  - Exclude generated/config files explicitly.
- Use a custom script if ESLint rules are too blunt for staged adoption.

**Verify:**

```bash
npm run lint
npm run typecheck
```

**Commit:** `chore(tooling): add readability budgets`

---

### Task 10: Polish Reviewer-Facing Docs

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/code-map.md`
- Create: `docs/threat-model.md`

**Action:**

- Put a short reviewer path near the top of the README.
- Add a simple architecture diagram.
- Document privacy/security assumptions.
- Keep known limitations honest and explicit.

**Verify:**

```bash
npm run format:check
```

**Commit:** `docs: sharpen portfolio reviewer path`

## Execution Order

Do Tasks 1-2 first because they create the safety rail. Then do Tasks 3-6 as the main readability pass. Do Task 7 before deeper graph work. Do Tasks 8-10 after the code shape stabilizes.

## Stop Conditions

- A refactor changes public behavior unexpectedly.
- Offline eval output regresses.
- Boundary rules require broad suppressions.
- A package-manager change modifies the lockfile beyond intentional dependency updates.
