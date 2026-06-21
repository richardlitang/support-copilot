# Frontend "Case Spine" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Support Copilot frontend around a living "Case Spine" backbone with an always-visible exhibits rail and an always-know-what-to-do guidance system, on the editorial-calm visual foundation ported from `frontend-visual-craft`.

**Architecture:** A fresh branch off `main`. Pure presentation/guidance logic lives in small tested `lib/*.ts` helpers (the TDD seam); visual React components consume those helpers and are verified manually + by the build gate. The pipeline "reveal" is a client-side replay of `result.pipelineTrace[]` — no backend, API, or data-shape changes. Two distinct UI concepts: a pre-run **setup stepper** (Docs→Ticket→Run, driven by existing `activeStep` logic) and a post-run **investigation spine** (data-driven off the real 8-step `pipelineTrace`).

**Tech Stack:** Next.js App Router (React 19, RSC), TypeScript, Tailwind v4 (+ `tailwind.config.ts` token layer), shadcn/ui, `motion` (Framer Motion's package, import from `motion/react`), `next/font/google` (Fraunces + Inter), Vitest.

## Global Constraints

- **No backend/API changes.** `/api/investigate` stays a single POST. The spine reveal is a client-side replay of `result.pipelineTrace[]`. No SSE/streaming.
- **No data-shape changes.** Reuse types from `lib/types/investigation.ts` exactly. No new fields, routes, or schema.
- **Preserve all states:** evidence-only mode, `needs_human_review`, docs-gap report, retry-with-context, mark-reviewed, history, upload polling, demo scenarios.
- **`PipelineTraceStep.status` is only `"complete" | "skipped" | "blocked"`** — there is no "pending". "Active" is a client-side playhead concept only.
- **Pipeline trace is 8 fixed steps**, ids in order: `request, retrieval, routing, tools, conflict, draft, review, persistence`. The spine renders whatever `result.pipelineTrace` contains; do not hardcode the set.
- **Accessibility:** every motion gated through `motion`'s `useReducedMotion()` (reduced → final state, no transforms). Citation cross-highlight reachable/visible via keyboard focus. AA contrast on warm surfaces. No information by color alone (keep status labels/badges).
- **Token values (hex):** `--paper:#faf8f4`, `--parchment:#f3efe7`, `--ledger:#ffffff`, `--graphite:#2b2a27`, `--sage:#5e7466`, `--copper:#9a6a3c`, `--signal:#3f6f8f`, `--ember:#b4452f`.
- **Fonts:** Fraunces (display serif, headings only) → `--font-display`; Inter (body) → `--font-sans`; `ui-monospace` for citation chips/codes/scores.
- **Verification gate:** `npm run verify` (`format:check && lint && typecheck && check:file-health && check:docker-runtime && check:k8s && test && eval:rag-contract && build`). `lint` runs `--max-warnings=0`. Per-slice fast checks: `npm run test`, `npm run typecheck`, `npm run lint`.
- **Reference (do not merge):** the `frontend-visual-craft` branch contains verified implementations of several helpers/components. Read with `git show frontend-visual-craft:<path>`. Port by re-applying onto `main`, never merge/rebase that branch.
- **Commits:** conventional commits; personal-project convention ends messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Stage specific files, never `git add -A`.

---

## File Structure

**New files:**
- `lib/motion.ts` — shared motion variants/transitions (port from branch).
- `lib/pipeline-presentation.ts` — pure spine accent + reveal helpers (port + extend for `skipped`).
- `lib/review-presentation.ts` — pure review-tone helper (port from branch).
- `lib/guidance.ts` — pure next-action + setup-step resolver (NEW).
- `lib/use-fresh-result.ts` — small hook returning a stable key per investigation (NEW, for once-per-result reveals).
- `components/answer/active-citation-context.tsx` — shared hover state (port from branch).
- `components/answer/pipeline-timeline.tsx` — the Case Spine reveal (port + adapt; replaces `pipeline-trace.tsx`).
- `components/support-shell/case-spine.tsx` — the left-rail spine wrapper (setup stepper pre-run, investigation spine post-run) + next-action CTA host (NEW).
- `components/support-shell/next-action.tsx` — the single dominant next-action affordance (NEW).
- `components/support-shell/history-drawer.tsx` — collapsible history (NEW; wraps existing `RecentInvestigations`).
- `tests/core/guidance.test.ts`, `tests/core/pipeline-presentation.test.ts`, `tests/core/review-presentation.test.ts` — unit tests for the pure helpers.

**Modified files:**
- `app/globals.css` — define token CSS vars, repoint body to warm palette + `--font-sans`, add `.surface` utility.
- `app/layout.tsx` — wire Fraunces + Inter via `next/font/google`.
- `tailwind.config.ts` — point `fontFamily.sans`/`serif` at the font CSS vars (verify only otherwise).
- `package.json` — add `motion` dependency.
- `components/SupportCopilotShell.tsx` — three-zone layout, ungate exhibits, mount spine + next-action + history drawer + `ActiveCitationProvider`, masthead.
- `components/AnswerPanel.tsx` — swap `PipelineTrace`→`PipelineTimeline`, answer-assembly cascade, calm review checkpoint.
- `components/EvidencePanel.tsx` — always-on; exhibit numbering language; cross-highlight wiring.
- `components/answer/source-citations.tsx` — `CitationMarker` emits active-citation hover/focus.

---

## Task 0: Branch off `main`

- [ ] **Step 1: Create the working branch**

Run: `git switch -c frontend-case-spine`
Expected: on a fresh branch off current `main` (verify `git status` shows `frontend-case-spine`, clean tree). All subsequent commits land here. Do **not** merge or rebase `frontend-visual-craft`.

---

## Task 1: Foundation — tokens, fonts, motion primitives

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `app/globals.css:1-53` (tokens + body + font var)
- Modify: `app/layout.tsx` (fonts)
- Modify: `tailwind.config.ts:fontFamily`
- Create: `lib/motion.ts`

**Interfaces:**
- Produces: CSS vars `--paper … --ember`, `--font-display`, `--font-sans` resolvable on `<body>`; `lib/motion.ts` exports `ease`, `springSoft: Transition`, `fadeRise: Variants`, `staggerParent: Variants`.

- [ ] **Step 1: Install motion**

Run: `npm install motion@^12`
Expected: `package.json` dependencies gain `"motion": "^12.x"`; lockfile updates.

- [ ] **Step 2: Create `lib/motion.ts`** (verbatim port from branch)

```ts
import type { Transition, Variants } from "motion/react";

export const ease = [0.16, 1, 0.3, 1] as const;

export const springSoft: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
};

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
```

- [ ] **Step 3: Wire fonts in `app/layout.tsx`**

Add at top (after existing imports), expose both as CSS variables, and apply the variable classes to `<body>` (keep the rest of the existing layout body/metadata intact):

```tsx
import { Fraunces, Inter } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
```

Then add `className={`${display.variable} ${sans.variable}`}` to the existing `<html>` element (merge with any existing className).

- [ ] **Step 4: Define tokens + repoint body in `app/globals.css`**

In the `:root` block (replacing the existing zinc/HSL `--background…--foreground` declarations is NOT required; ADD these warm tokens alongside), add:

```css
    --paper: #faf8f4;
    --parchment: #f3efe7;
    --ledger: #ffffff;
    --graphite: #2b2a27;
    --sage: #5e7466;
    --copper: #9a6a3c;
    --signal: #3f6f8f;
    --ember: #b4452f;
```

Replace the `body` rule's `color`/`font-family`/`background` with the warm system:

```css
  body {
    min-height: 100vh;
    color: var(--graphite);
    font-family: var(--font-sans), "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(154, 106, 60, 0.08), transparent 30%),
      radial-gradient(circle at top right, rgba(63, 111, 143, 0.07), transparent 28%),
      var(--paper);
  }
```

Add a shared surface utility inside `@layer utilities`:

```css
  .surface {
    border-radius: 1rem;
    border: 1px solid rgba(43, 42, 39, 0.08);
    background: var(--ledger);
    box-shadow: 0 18px 42px rgba(19, 21, 20, 0.06);
  }
  .font-display {
    font-family: var(--font-display), Georgia, serif;
  }
```

- [ ] **Step 5: Point tailwind font tokens at the CSS vars**

In `tailwind.config.ts`, change `fontFamily` to:

```ts
      fontFamily: {
        sans: ["var(--font-sans)", "Avenir Next", "Segoe UI", "sans-serif"],
        serif: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
      },
```

- [ ] **Step 6: Verify build + tokens resolve**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. Manually: `npm run dev`, load `/`, confirm warm background renders and `getComputedStyle(document.body).getPropertyValue('--paper')` returns `#faf8f4` in devtools.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/motion.ts app/layout.tsx app/globals.css tailwind.config.ts
git commit -m "$(printf 'feat(ui): wire editorial tokens, fonts, and motion primitives\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Pure presentation + guidance helpers (TDD core)

This is the testable seam. Everything visual later consumes these.

**Files:**
- Create: `lib/pipeline-presentation.ts`, `tests/core/pipeline-presentation.test.ts`
- Create: `lib/review-presentation.ts`, `tests/core/review-presentation.test.ts`
- Create: `lib/guidance.ts`, `tests/core/guidance.test.ts`

**Interfaces:**
- Produces:
  - `pipelineStepAccent(status: string): { text: string; ring: string; surface: string }`
  - `isStepRevealed(index: number, playhead: number): boolean`
  - `reviewTone(input: { reviewStatus: string; acknowledged: boolean }): { surface: string; accent: string; icon: string }`
  - `resolveNextAction(input: { documentCount: number; ticketText: string }): { stage: SetupStage; index: number; label: string; hint: string }` where `type SetupStage = "docs" | "ticket" | "investigate"`
  - `setupSteps(input: { documentCount: number; ticketText: string }): Array<{ stage: SetupStage; label: string; state: "done" | "active" | "upcoming" }>`

- [ ] **Step 1: Write failing test `tests/core/pipeline-presentation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";

describe("pipelineStepAccent", () => {
  it("maps complete to sage", () => {
    expect(pipelineStepAccent("complete").text).toBe("text-sage");
  });
  it("maps blocked to ember", () => {
    expect(pipelineStepAccent("blocked").text).toBe("text-ember");
  });
  it("maps skipped to a muted accent, not signal", () => {
    const accent = pipelineStepAccent("skipped");
    expect(accent.text).toBe("text-zinc-400");
    expect(accent.text).not.toBe("text-signal");
  });
  it("defaults unknown/active to signal", () => {
    expect(pipelineStepAccent("active").text).toBe("text-signal");
  });
});

describe("isStepRevealed", () => {
  it("reveals indices below the playhead", () => {
    expect(isStepRevealed(0, 1)).toBe(true);
    expect(isStepRevealed(1, 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/core/pipeline-presentation.test.ts`
Expected: FAIL — cannot find module `@/lib/pipeline-presentation`.

- [ ] **Step 3: Create `lib/pipeline-presentation.ts`** (port + `skipped` branch added)

```ts
export type PipelineAccent = {
  text: string;
  ring: string;
  surface: string;
};

export function pipelineStepAccent(status: string): PipelineAccent {
  if (status === "complete") {
    return { text: "text-sage", ring: "border-sage/30", surface: "bg-sage/5" };
  }
  if (status === "blocked") {
    return { text: "text-ember", ring: "border-ember/30", surface: "bg-ember/5" };
  }
  if (status === "skipped") {
    return { text: "text-zinc-400", ring: "border-zinc-200", surface: "bg-parchment/40" };
  }
  return { text: "text-signal", ring: "border-signal/30", surface: "bg-signal/5" };
}

export function isStepRevealed(index: number, playhead: number): boolean {
  return index < playhead;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/core/pipeline-presentation.test.ts`
Expected: PASS (4 + 1).

- [ ] **Step 5: Write failing test `tests/core/review-presentation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { reviewTone } from "@/lib/review-presentation";

describe("reviewTone", () => {
  it("uses calm ember-on-parchment when unacknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: false });
    expect(tone.accent).toBe("text-ember");
    expect(tone.surface).toContain("parchment");
  });
  it("switches to sage once acknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: true });
    expect(tone.accent).toBe("text-sage");
  });
});
```

- [ ] **Step 6: Run, verify fail; create `lib/review-presentation.ts`** (verbatim port)

Run first: `npx vitest run tests/core/review-presentation.test.ts` → FAIL (missing module). Then create:

```ts
export type ReviewTone = {
  surface: string;
  accent: string;
  icon: string;
};

export function reviewTone({
  acknowledged,
}: {
  reviewStatus: string;
  acknowledged: boolean;
}): ReviewTone {
  if (acknowledged) {
    return {
      surface: "border-sage/30 bg-sage/5",
      accent: "text-sage",
      icon: "border-sage/30 bg-ledger text-sage",
    };
  }
  return {
    surface: "border-ember/30 bg-parchment/60",
    accent: "text-ember",
    icon: "border-ember/30 bg-ledger text-ember",
  };
}
```

Run again: PASS.

- [ ] **Step 7: Write failing test `tests/core/guidance.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { resolveNextAction, setupSteps } from "@/lib/guidance";

describe("resolveNextAction", () => {
  it("asks for docs first when none uploaded", () => {
    const next = resolveNextAction({ documentCount: 0, ticketText: "" });
    expect(next.stage).toBe("docs");
    expect(next.index).toBe(1);
    expect(next.label).toContain("Add support docs");
  });
  it("asks for the ticket once docs exist but ticket is empty", () => {
    const next = resolveNextAction({ documentCount: 2, ticketText: "   " });
    expect(next.stage).toBe("ticket");
    expect(next.index).toBe(2);
  });
  it("offers to run once docs and ticket are present", () => {
    const next = resolveNextAction({ documentCount: 2, ticketText: "Refund failed" });
    expect(next.stage).toBe("investigate");
    expect(next.index).toBe(3);
  });
});

describe("setupSteps", () => {
  it("marks docs done, ticket active, investigate upcoming mid-flow", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "" });
    expect(steps.map((s) => s.state)).toEqual(["done", "active", "upcoming"]);
  });
  it("marks all done-then-active when ready to run", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "hi" });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active"]);
  });
});
```

- [ ] **Step 8: Run, verify fail**

Run: `npx vitest run tests/core/guidance.test.ts`
Expected: FAIL — missing module `@/lib/guidance`.

- [ ] **Step 9: Create `lib/guidance.ts`**

Mirrors the existing `activeStep` rule in `SupportCopilotShell` (`documents.length === 0 ? "docs" : ticket.trim() ? "investigate" : "ticket"`).

```ts
export type SetupStage = "docs" | "ticket" | "investigate";

export interface NextAction {
  stage: SetupStage;
  index: number;
  label: string;
  hint: string;
}

export function resolveNextAction(input: {
  documentCount: number;
  ticketText: string;
}): NextAction {
  if (input.documentCount === 0) {
    return {
      stage: "docs",
      index: 1,
      label: "Add support docs",
      hint: "Upload the documentation this ticket should be answered from.",
    };
  }
  if (!input.ticketText.trim()) {
    return {
      stage: "ticket",
      index: 2,
      label: "Paste the ticket",
      hint: "Drop in the customer's message to investigate.",
    };
  }
  return {
    stage: "investigate",
    index: 3,
    label: "Run investigation",
    hint: "Retrieve evidence, route, and draft a cited answer.",
  };
}

export function setupSteps(input: {
  documentCount: number;
  ticketText: string;
}): Array<{ stage: SetupStage; label: string; state: "done" | "active" | "upcoming" }> {
  const active = resolveNextAction(input).stage;
  const order: Array<{ stage: SetupStage; label: string }> = [
    { stage: "docs", label: "Docs" },
    { stage: "ticket", label: "Ticket" },
    { stage: "investigate", label: "Run" },
  ];
  const activeIndex = order.findIndex((s) => s.stage === active);
  return order.map((s, i) => ({
    ...s,
    state: i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming",
  }));
}
```

- [ ] **Step 10: Run all three suites, verify pass**

Run: `npx vitest run tests/core/pipeline-presentation.test.ts tests/core/review-presentation.test.ts tests/core/guidance.test.ts`
Expected: PASS (all).

- [ ] **Step 11: Commit**

```bash
git add lib/pipeline-presentation.ts lib/review-presentation.ts lib/guidance.ts tests/core/pipeline-presentation.test.ts tests/core/review-presentation.test.ts tests/core/guidance.test.ts
git commit -m "$(printf 'feat(ui): pure pipeline, review, and guidance presentation helpers\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: The next-action affordance + setup-aware spine shell

Build the guidance UI (the "always know what to do" pillar) and the spine wrapper that hosts the setup stepper pre-run. The investigation reveal is added in Task 4.

**Files:**
- Create: `components/support-shell/next-action.tsx`
- Create: `components/support-shell/case-spine.tsx`
- Modify: `components/SupportCopilotShell.tsx` (mount spine + next-action into the left zone)

**Interfaces:**
- Consumes: `resolveNextAction`, `setupSteps` (Task 2).
- Produces:
  - `<NextAction documentCount={number} ticketText={string} isInvestigating={boolean} onRun={() => void} />`
  - `<CaseSpine documentCount={number} ticketText={string} result={InvestigationResult | null} isInvestigating={boolean} />`

- [ ] **Step 1: Create `components/support-shell/next-action.tsx`**

```tsx
"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { resolveNextAction } from "@/lib/guidance";

export function NextAction({
  documentCount,
  ticketText,
  isInvestigating,
  onRun,
}: {
  documentCount: number;
  ticketText: string;
  isInvestigating: boolean;
  onRun: () => void;
}) {
  const next = resolveNextAction({ documentCount, ticketText });
  const canRun = next.stage === "investigate" && !isInvestigating;

  return (
    <div className="surface p-4">
      <p className="eyebrow">Next step</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-graphite">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal/10 font-mono text-[11px] text-signal">
          {next.index}
        </span>
        {next.label}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{next.hint}</p>
      {next.stage === "investigate" ? (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-graphite px-3 py-2 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
        >
          {isInvestigating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isInvestigating ? "Investigating…" : "Run investigation"}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/support-shell/case-spine.tsx`** (setup mode only for now; investigation slot wired in Task 4)

```tsx
"use client";

import { Check } from "lucide-react";
import { setupSteps } from "@/lib/guidance";
import type { InvestigationResult } from "@/lib/types/investigation";

export function CaseSpine({
  documentCount,
  ticketText,
  result,
  isInvestigating,
}: {
  documentCount: number;
  ticketText: string;
  result: InvestigationResult | null;
  isInvestigating: boolean;
}) {
  const steps = setupSteps({ documentCount, ticketText });
  const showInvestigation = Boolean(result) || isInvestigating;

  return (
    <div className="surface p-4">
      <p className="eyebrow">{showInvestigation ? "Investigation" : "Setup"}</p>
      <ol className="mt-3 grid gap-2">
        {steps.map((step) => (
          <li key={step.stage} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                step.state === "done"
                  ? "border-sage/30 bg-sage/10 text-sage"
                  : step.state === "active"
                    ? "border-signal/40 bg-signal/10 text-signal"
                    : "border-zinc-200 bg-parchment/40 text-zinc-400"
              }`}
            >
              {step.state === "done" ? <Check className="h-3 w-3" /> : null}
            </span>
            <span
              className={`text-sm ${step.state === "active" ? "font-semibold text-graphite" : "text-zinc-500"}`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 3: Mount into the left zone of `SupportCopilotShell.tsx`**

In the `left-stack` div (currently lines ~331-347), add `CaseSpine` and `NextAction` above the existing `UploadPanel`, and import them at the top. Replace the `left-stack` block's children opening with:

```tsx
          <div className="left-stack">
            <CaseSpine
              documentCount={documents.length}
              ticketText={ticket}
              result={result}
              isInvestigating={isInvestigating}
            />
            <NextAction
              documentCount={documents.length}
              ticketText={ticket}
              isInvestigating={isInvestigating}
              onRun={() => void handleInvestigate()}
            />
            <RecentInvestigations
```

Add imports near the other component imports:

```tsx
import { CaseSpine } from "@/components/support-shell/case-spine";
import { NextAction } from "@/components/support-shell/next-action";
```

- [ ] **Step 4: Typecheck + lint + manual check**

Run: `npm run typecheck && npm run lint`
Expected: PASS.
Manual (`npm run dev`): with no docs, spine shows Docs=active and next-action says "① Add support docs"; after uploading a doc and pasting a ticket, spine shows Docs/Ticket done, Run active, and the "Run investigation" button is enabled.

- [ ] **Step 5: Commit**

```bash
git add components/support-shell/next-action.tsx components/support-shell/case-spine.tsx components/SupportCopilotShell.tsx
git commit -m "$(printf 'feat(ui): setup spine and always-visible next-action guidance\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Case Spine investigation reveal (replaces inert pipeline trace)

**Files:**
- Create: `components/answer/pipeline-timeline.tsx`
- Modify: `components/AnswerPanel.tsx` (swap `PipelineTrace` → `PipelineTimeline`)
- Delete (after parity): `components/answer/pipeline-trace.tsx`

**Interfaces:**
- Consumes: `pipelineStepAccent`, `isStepRevealed` (Task 2); `fadeRise`, `staggerParent` (Task 1).
- Produces: `<PipelineTimeline result={InvestigationResult} />`

- [ ] **Step 1: Create `components/answer/pipeline-timeline.tsx`** (port from branch; `steps` dependency fixed to `result.investigationId` to avoid effect churn)

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fadeRise, staggerParent } from "@/lib/motion";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";
import type { InvestigationResult } from "@/lib/types/investigation";

export function PipelineTimeline({ result }: { result: InvestigationResult }) {
  const reduce = useReducedMotion();
  const steps = result.pipelineTrace;
  const [playhead, setPlayhead] = useState(0);
  const visiblePlayhead = reduce ? steps.length : playhead;

  useEffect(() => {
    if (reduce) {
      return;
    }
    setPlayhead(0);
    const timers = steps.map((_, index) =>
      window.setTimeout(() => {
        setPlayhead((current) => Math.max(current, index + 1));
      }, index * 300),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Replay only when a new investigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.investigationId, reduce]);

  if (!steps.length) {
    return null;
  }

  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Pipeline</p>
        <Badge variant="outline">{steps.length} steps</Badge>
      </div>

      <motion.ol
        className="mt-4 grid gap-2"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        {steps.map((step, index) => {
          const accent = pipelineStepAccent(step.status);
          const revealed = isStepRevealed(index, visiblePlayhead);

          return (
            <motion.li
              key={step.id}
              variants={fadeRise}
              className={`grid grid-cols-[auto_1fr] gap-3 transition-opacity duration-300 ${
                revealed ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold ${accent.ring} ${accent.surface} ${accent.text}`}
              >
                {index + 1}
              </span>

              <details className="min-w-0 rounded-lg border border-zinc-100 bg-parchment/40 px-3 py-2 open:bg-ledger">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-graphite">{step.label}</span>
                  <Badge
                    variant={
                      step.status === "complete"
                        ? "success"
                        : step.status === "blocked"
                          ? "danger"
                          : "outline"
                    }
                  >
                    {step.status}
                  </Badge>
                  <span className="block w-full text-xs leading-5 text-zinc-600">
                    {step.summary}
                  </span>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 lg:grid-cols-2">
                  <div>
                    <p className="eyebrow">Input sent</p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-ledger p-3 text-xs leading-5 text-zinc-700">
                      {JSON.stringify(step.input ?? null, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="eyebrow">Output returned</p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-ledger p-3 text-xs leading-5 text-zinc-700">
                      {JSON.stringify(step.output ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}
```

- [ ] **Step 2: Swap usage in `AnswerPanel.tsx`**

Replace the import `import { PipelineTrace } from "@/components/answer/pipeline-trace";` with `import { PipelineTimeline } from "@/components/answer/pipeline-timeline";`, and replace the single `<PipelineTrace ... />` usage with `<PipelineTimeline result={result} />` (drop any props `PipelineTrace` took that aren't `result`).

Run: `grep -n "PipelineTrace" components/AnswerPanel.tsx` first to find the exact usage, then edit.

- [ ] **Step 3: Typecheck + manual parity check**

Run: `npm run typecheck && npm run lint`
Manual: run a demo ticket → the 8 steps reveal in sequence (~300ms apart); each step expands to show input/output JSON; `complete`=sage, `blocked`=ember, `skipped`=muted numerals. Toggle OS reduced-motion → all steps appear instantly.

- [ ] **Step 4: Delete the dead file once parity confirmed**

Run: `git rm components/answer/pipeline-trace.tsx`
Then `grep -rn "pipeline-trace" components app` → expect no results.

- [ ] **Step 5: Verify + commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add components/answer/pipeline-timeline.tsx components/AnswerPanel.tsx
git commit -m "$(printf 'feat(answer): living case-spine pipeline reveal\n\nReplaces the inert pipeline-trace details dump with a choreographed,\ndata-driven reveal of result.pipelineTrace. Reduced-motion safe.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Ungate the exhibits rail (always first-class)

**Files:**
- Modify: `components/SupportCopilotShell.tsx` (render `EvidencePanel` whenever there is a run, regardless of debug flag; reserve the flag for deep internals)
- Modify: `components/EvidencePanel.tsx` (warm surfaces, "Exhibits" framing, quiet instructional empty state)

**Interfaces:**
- Consumes: existing `EvidencePanel` props `{ result, isInvestigating }`.

- [ ] **Step 1: Change the layout gate in `SupportCopilotShell.tsx`**

The `<section>` className currently keys the evidence column on `hasRunState && showDebugToggle`. Change both the layout-class condition and the panel render to depend on `hasRunState` only:

Replace:
```tsx
        <section
          className={
            hasRunState && showDebugToggle
              ? "workbench-layout workbench-layout--with-evidence"
              : "workbench-layout"
          }
        >
```
with:
```tsx
        <section
          className={
            hasRunState
              ? "workbench-layout workbench-layout--with-evidence"
              : "workbench-layout"
          }
        >
```

Replace:
```tsx
          {hasRunState && showDebugToggle ? (
            <EvidencePanel result={result} isInvestigating={isInvestigating} />
          ) : null}
```
with:
```tsx
          {hasRunState ? (
            <EvidencePanel
              result={result}
              isInvestigating={isInvestigating}
              showDebugDetails={showDebugToggle}
            />
          ) : null}
```

- [ ] **Step 2: Accept `showDebugDetails` in `EvidencePanel.tsx` and reframe copy**

Add `showDebugDetails?: boolean` to the props type. Change the header eyebrow/title copy from "Evidence rail / Documentation and context" to "Exhibits / Retrieved evidence", and change the empty-state `CardDescription` to the instructional line:

```tsx
            <CardDescription className="mt-2 text-xs leading-5">
              {result || isInvestigating
                ? "Every claim in the answer links back to these exhibits."
                : "Retrieved evidence will appear here. Every claim in the answer links back to it."}
            </CardDescription>
```

Gate the raw `score`/`rerankScore` numeric lines behind `showDebugDetails` (keep the human-readable filename/section/excerpt always visible). Swap `surface-shell`/`surface-muted` usages in this file to the new `.surface` utility where appropriate (visual only).

- [ ] **Step 3: Typecheck + manual check**

Run: `npm run typecheck && npm run lint`
Manual: with `NEXT_PUBLIC_DEBUG_RAG` unset, run a ticket → the exhibits rail is visible with chunks and tool sources; retrieval scores are hidden. Set the flag → scores reappear.

- [ ] **Step 4: Commit**

```bash
git add components/SupportCopilotShell.tsx components/EvidencePanel.tsx
git commit -m "$(printf 'feat(evidence): make the exhibits rail first-class for everyone\n\nDemotes NEXT_PUBLIC_DEBUG_RAG to gating only deep internals (scores),\nnot the rail itself.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Exhibit ↔ claim cross-highlighting

**Files:**
- Create: `components/answer/active-citation-context.tsx`
- Modify: `components/SupportCopilotShell.tsx` (wrap the result region in `ActiveCitationProvider`)
- Modify: `components/answer/source-citations.tsx` (`CitationMarker` emits active id on hover/focus)
- Modify: `components/EvidencePanel.tsx` (rows highlight when active)

**Interfaces:**
- Produces: `ActiveCitationProvider`, `useActiveCitation(): { active: string | null; setActive: (id: string | null) => void }`.

- [ ] **Step 1: Create `components/answer/active-citation-context.tsx`** (verbatim port from branch)

```tsx
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ActiveCitationValue = {
  active: string | null;
  setActive: (id: string | null) => void;
};

const ActiveCitationContext = createContext<ActiveCitationValue>({
  active: null,
  setActive: () => {},
});

export function ActiveCitationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <ActiveCitationContext.Provider value={value}>{children}</ActiveCitationContext.Provider>;
}

export function useActiveCitation(): ActiveCitationValue {
  return useContext(ActiveCitationContext);
}
```

- [ ] **Step 2: Wrap the result region in `SupportCopilotShell.tsx`**

Wrap the `<section className={... workbench-layout ...}>` block in `<ActiveCitationProvider>…</ActiveCitationProvider>` so both `AnswerPanel` (center) and `EvidencePanel` (right) share state. Add import:

```tsx
import { ActiveCitationProvider } from "@/components/answer/active-citation-context";
```

- [ ] **Step 3: Emit active id from `CitationMarker` (`source-citations.tsx`)**

Add the hook and pointer/focus handlers + active ring to the existing `<button>` (keep the existing tooltip and `aria-label`):

```tsx
import { useActiveCitation } from "@/components/answer/active-citation-context";
```
Inside `CitationMarker`, before `return`:
```tsx
  const { active, setActive } = useActiveCitation();
```
On the `<button>`, add:
```tsx
        onPointerEnter={() => setActive(citation)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(citation)}
        onBlur={() => setActive(null)}
        data-active={active === citation || undefined}
```
and append to its className: `${active === citation ? " ring-2 ring-signal/50" : ""}`.

- [ ] **Step 4: Highlight matching rows in `EvidencePanel.tsx`**

Add `import { useActiveCitation } from "@/components/answer/active-citation-context";` and `const { active } = useActiveCitation();` in the component body. For each doc and tool evidence row container, append a conditional highlight class:

```tsx
className={`surface-muted p-4 transition${active === item.id ? " ring-2 ring-signal/40 bg-signal/5" : ""}`}
```

- [ ] **Step 5: Typecheck + manual (mouse + keyboard) check**

Run: `npm run typecheck && npm run lint`
Manual: hover/Tab to a `[S1]` chip → matching exhibit row gains a ring. Confirm keyboard focus triggers it (not just mouse).

- [ ] **Step 6: Commit**

```bash
git add components/answer/active-citation-context.tsx components/SupportCopilotShell.tsx components/answer/source-citations.tsx components/EvidencePanel.tsx
git commit -m "$(printf 'feat(evidence): citation to exhibit cross-highlighting\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Answer-assembly cascade

**Files:**
- Modify: `components/AnswerPanel.tsx` (stagger the brief in, once per investigation)

**Interfaces:**
- Consumes: `fadeRise`, `staggerParent` (Task 1).

- [ ] **Step 1: Wrap the answer body in a keyed motion container**

In `AnswerPanel.tsx`, add `import { motion, useReducedMotion } from "motion/react";` and `import { fadeRise, staggerParent } from "@/lib/motion";`. Find the top-level wrapper that renders the case-brief header + `AnswerSection` + internal findings + pipeline. Wrap it:

```tsx
      <motion.div
        key={result.investigationId}
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        {/* existing header, AnswerSection, InternalFindings, PipelineTimeline */}
      </motion.div>
```

Wrap each major child (`AnswerSection`, internal findings section, review card, pipeline) as a `motion.div variants={fadeRise}` so they cascade top-to-bottom. Gate via `const reduce = useReducedMotion();` — when `reduce`, render the plain (non-motion) tree or pass `initial={false}`.

The `key={result.investigationId}` ensures the cascade plays once per investigation and does NOT replay on hover/mark-reviewed re-renders.

- [ ] **Step 2: Typecheck + manual check**

Run: `npm run typecheck && npm run lint`
Manual: a fresh answer cascades in once; hovering citations or clicking "mark reviewed" does NOT replay it. Reduced-motion → instant.

- [ ] **Step 3: Commit**

```bash
git add components/AnswerPanel.tsx
git commit -m "$(printf 'feat(answer): staggered answer-assembly reveal\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: `needs_human_review` as a calm checkpoint

**Files:**
- Modify: `components/AnswerPanel.tsx` (review-action card uses `reviewTone`, serif headline, spring icon)

**Interfaces:**
- Consumes: `reviewTone` (Task 2); `springSoft` (Task 1).

- [ ] **Step 1: Apply calm tone to the review card**

Add `import { reviewTone } from "@/lib/review-presentation";`. Find the review-action `Card` (currently red — `getReviewAction` drives it). Compute:

```tsx
  const tone = reviewTone({
    reviewStatus: result.reviewStatus,
    acknowledged: isReviewAcknowledged,
  });
```
Apply `tone.surface` to the card, `tone.accent` to the headline + icon container `tone.icon`. Make the headline a display-serif line ("This needs a human") via `className="font-display text-2xl"`. Keep ALL existing actions/handlers (`onRetryWithContext`, `onMarkReviewed`, `onDraftFromEvidence`) and the acknowledged/retry state logic intact — only the visual tone changes. Map any existing emerald "acknowledged" styling to `sage` via `tone`.

Optionally animate the icon in with `springSoft` using a small `motion.span`.

- [ ] **Step 2: Typecheck + manual check across states**

Run: `npm run typecheck && npm run lint`
Manual: trigger a `needs_human_review` ticket (e.g. a weak-retrieval demo scenario) → the block reads as calm ember-on-parchment with a serif headline, not an alarm-red error; "mark reviewed" flips it to sage; retry-with-context still works.

- [ ] **Step 3: Commit**

```bash
git add components/AnswerPanel.tsx
git commit -m "$(printf 'feat(answer): calm human-review checkpoint state\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: Chrome, history drawer, and polish sweep

**Files:**
- Create: `components/support-shell/history-drawer.tsx`
- Modify: `components/SupportCopilotShell.tsx` (serif masthead; move `RecentInvestigations` into the drawer)
- Modify: remaining `zinc-*` / ad-hoc `rounded-xl border … bg-white/80` in the main flow → `.surface` + tokens

**Interfaces:**
- Consumes: existing `RecentInvestigations` props.
- Produces: `<HistoryDrawer items, currentInvestigationId, onClear, onSelect />`

- [ ] **Step 1: Create `components/support-shell/history-drawer.tsx`**

A collapsible `<details>` wrapper around the existing `RecentInvestigations` so history stops occupying permanent left-column space:

```tsx
"use client";

import { History } from "lucide-react";
import { RecentInvestigations } from "@/components/RecentInvestigations";
import type { InvestigationHistoryItem } from "@/components/support-shell/history-storage";

export function HistoryDrawer(props: {
  items: InvestigationHistoryItem[];
  currentInvestigationId?: string;
  onClear: () => void;
  onSelect: (item: InvestigationHistoryItem) => void;
}) {
  if (!props.items.length) {
    return null;
  }
  return (
    <details className="surface px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-graphite">
        <History className="h-4 w-4 text-zinc-500" />
        Recent investigations
        <span className="font-mono text-[11px] text-zinc-400">({props.items.length})</span>
      </summary>
      <div className="mt-3">
        <RecentInvestigations
          currentInvestigationId={props.currentInvestigationId}
          items={props.items}
          onClear={props.onClear}
          onSelect={props.onSelect}
        />
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Wire the drawer + serif masthead in `SupportCopilotShell.tsx`**

Remove `RecentInvestigations` from `left-stack`; render `<HistoryDrawer .../>` at the top of `app-frame` (above the masthead card) or below the header. Replace the masthead: drop the `<Sparkles/>` + "Support workbench" badge; make `<h1>` a serif wordmark (`className="font-display text-2xl text-graphite"`) with the existing substance tagline ("Investigate support tickets with retrieved docs, tool context, and cited answers.").

Add import: `import { HistoryDrawer } from "@/components/support-shell/history-drawer";`. Remove the now-unused `RecentInvestigations` import and `Sparkles` import if no longer referenced (lint will flag unused).

- [ ] **Step 3: Token sweep in the main flow**

`grep -rn "zinc-\|rounded-xl border border-zinc-200/80 bg-white/80" components/SupportCopilotShell.tsx components/AnswerPanel.tsx components/EvidencePanel.tsx` and replace ad-hoc surfaces with `.surface` and obvious `zinc-*` text/borders with `graphite`/token equivalents where it improves consistency. Do NOT mass-rename inside `components/ui/*` (shadcn primitives) — main-flow components only.

- [ ] **Step 4: Full gate**

Run: `npm run verify`
Expected: PASS (format, lint, typecheck, file-health, docker/k8s checks, tests, rag-contract eval, build).

- [ ] **Step 5: Manual demo pass (all 5 PayBridge tickets)**

For each scenario in `demo/tickets.json`, confirm: spine reveal plays once; exhibit↔claim cross-highlight works via mouse AND keyboard; `needs_human_review` reads calm; exhibits rail visible without the debug flag; next-action correct at every step; `prefers-reduced-motion` renders everything instantly.

- [ ] **Step 6: Commit**

```bash
git add components/support-shell/history-drawer.tsx components/SupportCopilotShell.tsx components/AnswerPanel.tsx components/EvidencePanel.tsx
git commit -m "$(printf 'style(ui): serif masthead, history drawer, token polish sweep\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Notes for the implementer

- **Read before editing.** For each modified component, `grep` for the exact anchor (e.g. `grep -n "PipelineTrace\|showDebugToggle\|left-stack" components/SupportCopilotShell.tsx`) since line numbers drift between tasks.
- **The `.surface` utility** is defined in Task 1. Earlier-task components may still carry `surface-shell`/`surface-muted`; the Task 9 sweep reconciles them — don't pre-emptively rip them out and break intermediate states.
- **Branch source of truth for ports:** `git show frontend-visual-craft:<path>` for `lib/motion.ts`, `lib/pipeline-presentation.ts`, `lib/review-presentation.ts`, `components/answer/pipeline-timeline.tsx`, `components/answer/active-citation-context.tsx`. This plan already inlines their current contents; if they differ, prefer this plan's version (it adds the `skipped` accent and the replay-on-new-investigation fix).
- **`lib/use-fresh-result.ts`** listed in the file structure is optional sugar; Task 7 achieves once-per-result via `key={result.investigationId}` directly, so you may skip creating it. (Left in the structure as an allowed alternative, not a required deliverable.)
- **"Narrated run" is a spinner, not live stage narration.** The spec's §4 "the run is narrated" cannot mean live per-stage progress: there is no streaming (Global Constraints) and `pipelineTrace` only exists *after* the response lands. The honest delivery is: during `isInvestigating` the next-action shows the "Investigating…" spinner (Task 3) and the spine stays in setup mode; the moment the result arrives, the Task 4 spine reveal plays the real 8 stages in sequence (~300ms apart), which reads as narration without faking live progress. Do not invent fake intermediate stages.
