# Frontend Visual Craft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Support Copilot frontend to an editorial-calm, motion-choreographed experience with demo wow-factor, without changing information architecture or backend contracts.

**Architecture:** Finish wiring the dormant editorial token system already declared in `tailwind.config.ts`, add a shared motion primitives layer (`motion` library), then implement four choreographed "signature moments" (living pipeline replay, citation↔evidence cross-highlight, answer-assembly reveal, calm human-review checkpoint) and a broad polish pass. The pipeline "live" feel is a **client-side replay** of `result.pipelineTrace[]`; there is no streaming.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, `motion` (Framer Motion), `next/font`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-17-frontend-visual-craft-design.md`

## Global Constraints

- **No backend/API/schema changes.** `/api/investigate` stays a single POST. The pipeline reveal replays `result.pipelineTrace[]` client-side. No SSE/streaming.
- **No data-shape changes.** Reuse existing types in `lib/types/investigation` (`InvestigationResult`, `StructuredClaim`, `CitationId`, `docEvidence`, `toolEvidence`, pipeline trace steps).
- **Preserve all current behavior/states:** evidence-only mode, `needs_human_review`, docs-gap report, retry-with-context, mark-reviewed, history, upload polling, debug toggle (`NEXT_PUBLIC_DEBUG_RAG`).
- **All motion gated through** `useReducedMotion()` from `motion/react`; reduced-motion renders final state instantly.
- **Citation cross-highlight must be keyboard-reachable** (markers are already `<button>`s).
- **Testing approach (this repo has no DOM test runner):** vitest runs in `node` env, includes only `tests/**/*.test.ts`. Unit-test extracted **pure helpers** with real assertions. Component changes get a **no-throw smoke test** following the pattern in `tests/infrastructure/quality-check-card.test.ts` (call the component function, assert it does not throw). Visual/motion correctness is verified via `npm run build` + a manual demo pass over the 5 PayBridge tickets. Do **not** add jsdom/testing-library.
- **Verification:** `npm run lint && npm run typecheck && npm run test && npm run build` after every task; `npm run verify` before declaring the feature done.
- **Commits:** conventional commits, personal-project style, end with `Co-Authored-By: Claude <noreply@anthropic.com>`. Stage specific files (no `git add -A`).

---

## File Structure

**Create:**
- `lib/motion.ts` — shared motion variants/transitions (`ease`, `springSoft`, `fadeRise`, `staggerParent`).
- `lib/pipeline-presentation.ts` — pure helpers for the timeline (`pipelineStepAccent`, `isStepRevealed`).
- `lib/review-presentation.ts` — pure helper mapping a result to a review tone (`reviewTone`).
- `components/answer/pipeline-timeline.tsx` — animated pipeline replay (replaces `pipeline-trace.tsx` usage).
- `components/answer/active-citation-context.tsx` — shared hover/focus citation state.
- Tests: `tests/core/pipeline-presentation.test.ts`, `tests/core/review-presentation.test.ts`, `tests/infrastructure/pipeline-timeline.test.ts`.

**Modify:**
- `app/layout.tsx` — wire Fraunces + Inter via `next/font`.
- `app/globals.css` — define editorial CSS variables, repoint background/font.
- `components/AnswerPanel.tsx` — swap pipeline component, add answer-assembly reveal, calm review state.
- `components/EvidencePanel.tsx` — consume active-citation context for cross-highlight.
- `components/answer/source-citations.tsx` — emit active-citation on hover/focus.
- `components/SupportCopilotShell.tsx` — wrap result region in `ActiveCitationProvider`.

---

## Task 1: Foundation — editorial tokens, fonts, motion primitives

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css:4-53` (the `@layer base` block)
- Create: `lib/motion.ts`

**Interfaces:**
- Produces: CSS vars `--paper --parchment --ledger --graphite --sage --copper --signal --ember` on `:root`; CSS vars `--font-display`, `--font-sans` on `<body>`; `lib/motion.ts` exporting `ease`, `springSoft`, `fadeRise`, `staggerParent`.

- [ ] **Step 1: Install the motion library**

Run: `npm install motion`
Expected: `motion` added to `package.json` dependencies; lockfile updates.

- [ ] **Step 2: Wire fonts in `app/layout.tsx`**

Replace the file contents with:

```tsx
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Support Copilot",
  description: "A grounded support investigation assistant with visible evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Define editorial tokens and repoint base styles in `app/globals.css`**

In the `:root` block (`app/globals.css:5-26`), add the editorial variables after the existing `--radius` line:

```css
    /* Editorial token system (backs tailwind.config.ts colors) */
    --paper: #faf8f4;
    --parchment: #f3efe7;
    --ledger: #ffffff;
    --graphite: #2b2a27;
    --sage: #5e7466;
    --copper: #9a6a3c;
    --signal: #3f6f8f;
    --ember: #b4452f;
```

Then update the `body` rule (`app/globals.css:37-46`) to use the warm tokens and the new font variable:

```css
  body {
    min-height: 100vh;
    color: var(--graphite);
    font-family: var(--font-sans), "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(154, 106, 60, 0.10), transparent 30%),
      radial-gradient(circle at top right, rgba(63, 111, 143, 0.08), transparent 28%),
      var(--paper);
  }
```

- [ ] **Step 4: Create the motion primitives in `lib/motion.ts`**

```ts
import type { Transition, Variants } from "motion/react";

export const ease = [0.16, 1, 0.3, 1] as const; // expo-out, calm settle

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

- [ ] **Step 5: Verify build and types**

Run: `npm run typecheck && npm run build`
Expected: PASS. App compiles; fonts resolve; no missing-variable errors.

- [ ] **Step 6: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: warm paper background, Inter body text, no layout breakage. (Headings switch to serif in later tasks.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app/layout.tsx app/globals.css lib/motion.ts
git commit -m "feat(ui): wire editorial token system, fonts, and motion primitives

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Pure pipeline presentation helpers

**Files:**
- Create: `lib/pipeline-presentation.ts`
- Test: `tests/core/pipeline-presentation.test.ts`

**Interfaces:**
- Consumes: pipeline trace step `status` strings (`"complete" | "blocked" | other`).
- Produces: `pipelineStepAccent(status: string): { text: string; ring: string; surface: string }` and `isStepRevealed(index: number, playhead: number): boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/core/pipeline-presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";

describe("pipelineStepAccent", () => {
  it("maps complete to sage tones", () => {
    expect(pipelineStepAccent("complete").text).toContain("sage");
  });

  it("maps blocked to ember tones", () => {
    expect(pipelineStepAccent("blocked").text).toContain("ember");
  });

  it("falls back to signal tones for any other status", () => {
    expect(pipelineStepAccent("running").text).toContain("signal");
    expect(pipelineStepAccent("").text).toContain("signal");
  });
});

describe("isStepRevealed", () => {
  it("reveals steps with index below the playhead", () => {
    expect(isStepRevealed(0, 1)).toBe(true);
    expect(isStepRevealed(2, 3)).toBe(true);
  });

  it("hides steps at or beyond the playhead", () => {
    expect(isStepRevealed(1, 1)).toBe(false);
    expect(isStepRevealed(4, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/pipeline-presentation.test.ts`
Expected: FAIL with module-not-found / `pipelineStepAccent is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/pipeline-presentation.ts`:

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
  return { text: "text-signal", ring: "border-signal/30", surface: "bg-signal/5" };
}

export function isStepRevealed(index: number, playhead: number): boolean {
  return index < playhead;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/pipeline-presentation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline-presentation.ts tests/core/pipeline-presentation.test.ts
git commit -m "feat(answer): add pure pipeline presentation helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Living pipeline timeline component

**Files:**
- Create: `components/answer/pipeline-timeline.tsx`
- Test: `tests/infrastructure/pipeline-timeline.test.ts`
- Modify: `components/AnswerPanel.tsx:16` (import) and `:407` (usage)

**Interfaces:**
- Consumes: `pipelineStepAccent`, `isStepRevealed` (Task 2); `fadeRise`, `staggerParent` (Task 1); `result: InvestigationResult`.
- Produces: `PipelineTimeline({ result }: { result: InvestigationResult })` default-exported as named export `PipelineTimeline`.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/infrastructure/pipeline-timeline.test.ts` (node-env no-throw smoke test, mirroring `quality-check-card.test.ts`). Because the component uses `useEffect`/`useState`, the test asserts the module imports and the export is callable, not a full render:

```ts
import { describe, expect, it } from "vitest";
import { PipelineTimeline } from "@/components/answer/pipeline-timeline";

describe("PipelineTimeline", () => {
  it("is exported as a function component", () => {
    expect(typeof PipelineTimeline).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/infrastructure/pipeline-timeline.test.ts`
Expected: FAIL with module-not-found for `@/components/answer/pipeline-timeline`.

- [ ] **Step 3: Implement the timeline component**

Create `components/answer/pipeline-timeline.tsx`:

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
  const [playhead, setPlayhead] = useState(reduce ? steps.length : 0);

  useEffect(() => {
    if (reduce) {
      setPlayhead(steps.length);
      return;
    }

    setPlayhead(0);
    const timers = steps.map((_, index) =>
      window.setTimeout(() => {
        setPlayhead((current) => Math.max(current, index + 1));
      }, index * 300),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [result.investigationId, reduce, steps.length]);

  if (!steps.length) {
    return null;
  }

  return (
    <section className="rounded-panel border border-zinc-200/70 bg-ledger/80 p-5 shadow-evidence">
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
          const revealed = isStepRevealed(index, playhead);

          return (
            <motion.li
              key={step.id}
              variants={fadeRise}
              className={`grid grid-cols-[auto_1fr] gap-3 transition-opacity duration-300 ${
                revealed ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${accent.ring} ${accent.surface} ${accent.text}`}
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

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `npm run test -- tests/infrastructure/pipeline-timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Swap the component into `AnswerPanel.tsx`**

In `components/AnswerPanel.tsx`, change the import (line 16) from:

```tsx
import { PipelineTrace } from "@/components/answer/pipeline-trace";
```

to:

```tsx
import { PipelineTimeline } from "@/components/answer/pipeline-timeline";
```

And change the usage (line 407) from `<PipelineTrace result={result} />` to:

```tsx
<PipelineTimeline result={result} />
```

- [ ] **Step 6: Verify build, types, and full test run**

Run: `npm run typecheck && npm run test && npm run build`
Expected: PASS. (`pipeline-trace.tsx` is now unused but left in place; remove in Task 8 polish if desired.)

- [ ] **Step 7: Manual check**

Run: `npm run dev`, run a PayBridge sample ticket (e.g. "Live mode mismatch").
Expected: pipeline steps reveal in sequence, expandable JSON preserved, full content shown instantly under OS "reduce motion".

- [ ] **Step 8: Commit**

```bash
git add components/answer/pipeline-timeline.tsx tests/infrastructure/pipeline-timeline.test.ts components/AnswerPanel.tsx
git commit -m "feat(answer): living pipeline timeline reveal

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Active-citation context + evidence↔claim cross-highlight

**Files:**
- Create: `components/answer/active-citation-context.tsx`
- Modify: `components/SupportCopilotShell.tsx` (wrap result region)
- Modify: `components/answer/source-citations.tsx` (emit on hover/focus, ring when active)
- Modify: `components/EvidencePanel.tsx` (ring/tint when active)

**Interfaces:**
- Produces: `ActiveCitationProvider({ children })`, `useActiveCitation(): { active: string | null; setActive: (id: string | null) => void }`.
- Consumes: existing evidence item `id` values (`docEvidence[].id`, `toolEvidence[].id`) and `CitationId` markers.

- [ ] **Step 1: Create the context provider**

Create `components/answer/active-citation-context.tsx`:

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
  return (
    <ActiveCitationContext.Provider value={value}>{children}</ActiveCitationContext.Provider>
  );
}

export function useActiveCitation(): ActiveCitationValue {
  return useContext(ActiveCitationContext);
}
```

- [ ] **Step 2: Wrap the result region in `SupportCopilotShell.tsx`**

In `components/SupportCopilotShell.tsx`, add the import near the other component imports (after line 7):

```tsx
import { ActiveCitationProvider } from "@/components/answer/active-citation-context";
```

Then wrap the `<section className={...workbench-layout...}>` block (lines 321-398) so both the center answer stack and the right evidence panel share the provider. Replace the opening `<section ...>` with `<ActiveCitationProvider><section ...>` and the matching closing `</section>` with `</section></ActiveCitationProvider>`. (The provider must wrap both `center-stack` and `EvidencePanel` — wrapping the whole `<section>` satisfies this.)

- [ ] **Step 3: Emit active citation from `CitationMarker`**

In `components/answer/source-citations.tsx`, add the import at the top:

```tsx
import { useActiveCitation } from "@/components/answer/active-citation-context";
```

Then update `CitationMarker` (lines 120-146) so the `<button>` reports hover/focus and shows a ring when active:

```tsx
export function CitationMarker({
  citation,
  result,
}: {
  citation: CitationId;
  result: InvestigationResult;
}) {
  const title = getSourceTitle(result, citation);
  const excerpt = getSourceExcerpt(result, citation);
  const { active, setActive } = useActiveCitation();
  const isActive = active === citation;

  return (
    <span className="group/source relative inline-flex align-baseline">
      <button
        type="button"
        onPointerEnter={() => setActive(citation)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(citation)}
        onBlur={() => setActive(null)}
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
          citation.startsWith("S")
            ? "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
        } ${isActive ? "ring-2 ring-signal/50" : ""}`}
        aria-label={`Show source ${citation}`}
      >
        {citation}
      </button>
      <SourcePreview citation={citation} excerpt={excerpt} result={result} title={title} />
    </span>
  );
}
```

- [ ] **Step 4: Highlight matching rows in `EvidencePanel.tsx`**

In `components/EvidencePanel.tsx`, add the import after line 8:

```tsx
import { useActiveCitation } from "@/components/answer/active-citation-context";
```

Inside the `EvidencePanel` component body, after the `citations` set (line 23), read the active id:

```tsx
  const { active, setActive } = useActiveCitation();
```

For the doc evidence row container (line 68) and the tool evidence row container (line 139), make each row report hover and reflect the active state. Replace the doc row opening `<div key={item.id} className="surface-muted p-4">` with:

```tsx
<div
  key={item.id}
  onPointerEnter={() => setActive(item.id)}
  onPointerLeave={() => setActive(null)}
  className={`surface-muted p-4 transition ${
    active === item.id ? "ring-2 ring-signal/50 bg-signal/5" : ""
  }`}
>
```

Apply the identical pattern to the tool evidence row opening `<div key={item.id} className="surface-muted p-4">` at line 139.

- [ ] **Step 5: Verify build, types, tests**

Run: `npm run typecheck && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check (requires debug mode for the rail)**

Run: `NEXT_PUBLIC_DEBUG_RAG=true npm run dev`, run a ticket that produces citations, hover a `[S1]` chip and Tab to it.
Expected: the matching evidence row in the right rail gains a ring + tint on both hover and keyboard focus; hovering a row does not error. Reverse (hover row) tints the row.

- [ ] **Step 7: Commit**

```bash
git add components/answer/active-citation-context.tsx components/SupportCopilotShell.tsx components/answer/source-citations.tsx components/EvidencePanel.tsx
git commit -m "feat(evidence): citation and evidence cross-highlighting

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Answer-assembly reveal

**Files:**
- Modify: `components/AnswerPanel.tsx` (`AnswerSection` lines 39-86, `InternalFindings` lines 88-131, and the result root at line 324)

**Interfaces:**
- Consumes: `fadeRise`, `staggerParent` (Task 1); `useReducedMotion` from `motion/react`.
- Produces: no new exports; visual behavior only.

- [ ] **Step 1: Add motion imports to `AnswerPanel.tsx`**

At the top of `components/AnswerPanel.tsx`, add:

```tsx
import { motion, useReducedMotion } from "motion/react";
import { fadeRise, staggerParent } from "@/lib/motion";
```

- [ ] **Step 2: Animate the claim list in `AnswerSection`**

In `AnswerSection`, replace the claims wrapper (lines 61-78, the `<div className="mt-4 space-y-4">` containing the `claims.map`) so the inner list is a staggered motion list:

```tsx
      {claims.length ? (
        <motion.div
          className="mt-4 space-y-4"
          variants={staggerParent}
          initial="hidden"
          animate="show"
        >
          <div className="space-y-3 rounded-lg bg-zinc-50/70 p-4">
            {claims.map((claim, index) => (
              <motion.div
                key={`${claim.text}-${index}`}
                variants={fadeRise}
                className="text-[15px] leading-7 text-zinc-900"
              >
                {claim.text}{" "}
                <span className="inline-flex flex-wrap gap-1 align-baseline">
                  {claim.citations.map((citation) => (
                    <CitationMarker
                      key={`${claim.text}-${citation}`}
                      citation={citation}
                      result={result}
                    />
                  ))}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
```

- [ ] **Step 3: Key the animated result root so it plays once per investigation**

In the main `return` of `AnswerPanel` (line 324), change the outer wrapper from `<div className="space-y-4">` to a keyed motion wrapper so a new investigation replays the cascade but in-place re-renders (hover, mark-reviewed) do not:

```tsx
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={result.investigationId}
      className="space-y-4"
      variants={staggerParent}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
```

Change the matching closing `</div>` of that block (line 510) to `</motion.div>`.

> Note: `const reviewAction = ...` and the other `const`s currently sit between line 316 and the return. Place `const reduce = useReducedMotion();` alongside them (before the `return`), not inside JSX.

- [ ] **Step 4: Verify build, types, tests**

Run: `npm run typecheck && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, run a ticket.
Expected: case brief, then claims cascade in once; hovering citations or clicking "Mark reviewed" does NOT replay the cascade; reduce-motion shows everything instantly.

- [ ] **Step 6: Commit**

```bash
git add components/AnswerPanel.tsx
git commit -m "feat(answer): staggered answer-assembly reveal

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Review-tone helper

**Files:**
- Create: `lib/review-presentation.ts`
- Test: `tests/core/review-presentation.test.ts`

**Interfaces:**
- Consumes: `InvestigationResult` (`reviewStatus`, and acknowledgement is passed in).
- Produces: `reviewTone({ reviewStatus, acknowledged }: { reviewStatus: string; acknowledged: boolean }): { surface: string; accent: string; icon: string }` returning Tailwind class fragments using the editorial tokens.

- [ ] **Step 1: Write the failing test**

Create `tests/core/review-presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reviewTone } from "@/lib/review-presentation";

describe("reviewTone", () => {
  it("uses sage tones when acknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: true });
    expect(tone.accent).toContain("sage");
  });

  it("uses ember tones (not raw red) when review is needed and unacknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: false });
    expect(tone.accent).toContain("ember");
    expect(tone.surface).toContain("parchment");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/review-presentation.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement**

Create `lib/review-presentation.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/review-presentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/review-presentation.ts tests/core/review-presentation.test.ts
git commit -m "feat(answer): add review-tone presentation helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Calm human-review checkpoint state

**Files:**
- Modify: `components/AnswerPanel.tsx` (review-action `Card`, lines 411-489)

**Interfaces:**
- Consumes: `reviewTone` (Task 6); `motion`, `springSoft` (Tasks 1/5 imports already present); existing `reviewAction`, `isReviewAcknowledged`, `isReviewRetryActive`.
- Produces: no new exports; restyled review block.

- [ ] **Step 1: Import the tone helper and spring**

In `components/AnswerPanel.tsx`, add to the existing imports:

```tsx
import { reviewTone } from "@/lib/review-presentation";
import { springSoft } from "@/lib/motion";
```

(`motion` is already imported from Task 5.)

- [ ] **Step 2: Apply the tone to the review card**

Compute the tone just before the review-action JSX (near the other `const`s before `return`, after `reviewAction`):

```tsx
  const tone = reviewAction
    ? reviewTone({ reviewStatus: result.reviewStatus, acknowledged: isReviewAcknowledged })
    : null;
```

Then replace the review `Card`'s `className` (line 412-417) to use the tone surface, and animate the status icon. Change the `<Card className={ isReviewAcknowledged ? ... : ... }>` to:

```tsx
        <Card className={tone ? tone.surface : ""}>
```

Replace the icon wrapper `<div className={ ... }>` (lines 422-428) with a `motion.div` using `springSoft` and the tone icon classes:

```tsx
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springSoft}
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    tone ? tone.icon : ""
                  }`}
                >
                  {isReviewAcknowledged ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </motion.div>
```

Give the headline (`<h3>` at line 452) an editorial serif treatment by changing its className to:

```tsx
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.02em] text-graphite">
```

- [ ] **Step 3: Verify build, types, tests**

Run: `npm run typecheck && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, run the "Weak evidence" PayBridge sample (routes to `needs_human_review`).
Expected: review block reads as a calm parchment/ember checkpoint (not alarm-red), serif headline, icon springs in; "Mark reviewed" flips to sage; retry-with-context and open-questions still work.

- [ ] **Step 5: Commit**

```bash
git add components/AnswerPanel.tsx
git commit -m "feat(answer): calm human-review checkpoint state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Broad editorial polish pass

**Files:**
- Modify: `app/globals.css` (`.surface-shell`, `.surface-muted`, `.eyebrow`)
- Modify: `components/SupportCopilotShell.tsx` (header card, lines 287-313)
- Modify: `components/AnswerPanel.tsx` (display-serif on the main card title + empty/investigating states)
- Delete: `components/answer/pipeline-trace.tsx` (now unused)

**Interfaces:**
- Consumes: editorial tokens (Task 1).
- Produces: no new exports; unified surfaces, editorial empty/loading states.

- [ ] **Step 1: Warm up shared surfaces in `globals.css`**

Update `.surface-shell` (lines 68-74) and `.surface-muted` (lines 76-80) to the warm palette, and `.eyebrow` color (line 87) to graphite-muted:

```css
  .surface-shell {
    border-radius: 0.75rem;
    border: 1px solid rgba(43, 42, 39, 0.10);
    background: color-mix(in srgb, var(--ledger) 92%, transparent);
    box-shadow: 0 14px 34px rgba(43, 42, 39, 0.06);
    backdrop-filter: blur(8px);
  }

  .surface-muted {
    border-radius: 0.625rem;
    border: 1px solid rgba(43, 42, 39, 0.08);
    background: color-mix(in srgb, var(--parchment) 80%, transparent);
  }
```

And in `.eyebrow`, change `color: rgb(113 113 122);` to:

```css
    color: color-mix(in srgb, var(--graphite) 55%, transparent);
```

- [ ] **Step 2: Editorial header in `SupportCopilotShell.tsx`**

Change the `<h1>` (line 295) to use the display serif:

```tsx
                <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em] text-graphite">
                  Support Copilot
                </h1>
```

- [ ] **Step 3: Editorial titles + warmer empty/investigating states in `AnswerPanel.tsx`**

Give the main `CardTitle` (line 331) and the empty-state/investigating `<h2>` headings (lines 266, 287) the display serif by prefixing their classNames with `font-[family-name:var(--font-display)]`. For the investigating state (lines 260-278), replace the static centered text block with a calm shimmer that previews the pipeline — reuse the existing `case-progress` keyframe:

```tsx
  if (isInvestigating) {
    return (
      <Card className="surface-shell">
        <CardContent className="min-h-[260px] space-y-3 p-8">
          <p className="eyebrow">Investigating</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-graphite">
            {executionMode === "evidence_only" ? "Finding evidence…" : "Checking evidence…"}
          </h2>
          <div className="mt-4 grid gap-2">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="relative h-8 overflow-hidden rounded-lg bg-parchment/50"
              >
                <span className="absolute inset-y-0 left-0 w-1/3 bg-signal/10 [animation:case-progress_1.6s_ease-in-out_infinite]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
```

- [ ] **Step 4: Delete the dead pipeline-trace component**

Run: `git rm components/answer/pipeline-trace.tsx`
Then run: `grep -rn "pipeline-trace" app components lib tests`
Expected: no remaining references.

- [ ] **Step 5: Full verification gate**

Run: `npm run verify`
Expected: PASS (format, lint, typecheck, file-health, docker/k8s checks, tests, eval, build).

> If `npm run format:check` fails, run `npm run format` and re-stage.

- [ ] **Step 6: Manual demo pass over all 5 PayBridge tickets**

Run: `NEXT_PUBLIC_DEBUG_RAG=true npm run dev`, walk the 5 samples from README "Canonical Demo Flow":
Expected: pipeline reveal, cross-highlight, answer cascade, calm review state, warm surfaces, serif headings — all coherent. Re-check once with OS "reduce motion" on (everything instant, no broken layout).

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/SupportCopilotShell.tsx components/AnswerPanel.tsx
git commit -m "style(ui): broad editorial polish pass and remove dead trace component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §4 deps (motion, fonts) → Task 1. ✓
- §5 tokens/type/depth/motion → Task 1 (tokens, fonts, primitives) + Task 8 (surfaces, serif headings). ✓
- §6 Phase 0 → Task 1; Phase 1 → Tasks 2–3; Phase 2 → Task 4; Phase 3 → Task 5; Phase 4 → Tasks 6–7; Phase 5 → Task 8. ✓
- §7 accessibility (reduced-motion, keyboard cross-highlight) → Tasks 3, 4, 5, and manual checks. ✓
- §8 verification → per-task gates + Task 8 `npm run verify` + manual demo pass. ✓
- §9 out-of-scope respected (no API/schema/streaming changes). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `pipelineStepAccent`/`isStepRevealed` (Task 2) consumed in Task 3; `ActiveCitationProvider`/`useActiveCitation` (Task 4) consumed in same task's edits; `reviewTone` signature `{ reviewStatus, acknowledged }` defined in Task 6, consumed identically in Task 7; `fadeRise`/`staggerParent`/`springSoft`/`ease` defined in Task 1, consumed in Tasks 3/5/7. ✓
