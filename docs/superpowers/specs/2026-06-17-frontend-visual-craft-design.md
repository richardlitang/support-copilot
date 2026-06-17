# Frontend Visual Craft — Design & Codex Handover

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation
**Approach:** C — Foundation + Signature Moments
**Aesthetic:** Editorial & calm base, demo wow-factor through orchestrated motion
**Audience for this doc:** an implementing agent (Codex) with no prior context

---

## 1. Goal

Make the Support Copilot frontend look and feel like a premium, crafted product
instead of a stock shadcn dashboard — **without** changing the information
architecture or backend contracts. The current 3-column workbench flow
(left: history + upload, center: ticket composer + answer, right: evidence rail
in debug mode) is strong and stays. We elevate *how it looks and how it moves*.

Two combined targets:

- **Editorial & calm** — generous rhythm, real type scale, a display serif,
  warm neutral surfaces, soft depth. Approachable and trustworthy, not a cockpit.
- **Demo wow-factor** — the trust story (retrieve → route → evidence → draft →
  review) becomes a *choreographed reveal* a first-time viewer can follow during
  the 3-minute interview walkthrough (`docs/demo-script.md`).

Wow comes from **orchestration and motion on calm surfaces**, never from loud
color or glassmorphism.

## 2. Hard constraints (do not violate)

- **No backend/API changes.** `/api/investigate` stays a single POST. The
  "live pipeline" is a **client-side replay** of `result.pipelineTrace[]` after
  the response lands. Do not add SSE/streaming.
- **No data-shape changes.** Reuse existing types from
  `lib/types/investigation` (`InvestigationResult`, `StructuredClaim`,
  `CitationId`, pipeline trace steps, `docEvidence`, `toolEvidence`).
- **Preserve all current functionality and states**: evidence-only mode,
  `needs_human_review`, docs-gap report, retry-with-context, mark-reviewed,
  history, upload polling, debug toggle (`NEXT_PUBLIC_DEBUG_RAG`).
- **Accessibility:** every motion must honor `prefers-reduced-motion`. Citation
  cross-highlighting must be keyboard-reachable (the markers are already
  `<button>`s).
- **Verification must pass** (`npm run verify`) — lint, typecheck, format, tests,
  build. Keep diffs reviewable.

## 3. Key findings from the current codebase

These shape the plan — read before starting.

1. **An editorial token system already exists but is unwired.**
   `tailwind.config.ts` declares colors `paper / parchment / ledger / graphite /
   sage / copper / signal / ember` (all `var(--*)`), `fontFamily.serif`
   (`Iowan Old Style`), `boxShadow.panel` / `boxShadow.evidence`, and
   `borderRadius.panel` (28px). **None of these CSS variables are defined in
   `app/globals.css`**, which instead runs a separate zinc/HSL system with
   `font-family: "Avenir Next"`. Phase 0 finishes wiring this dormant layer.

2. **Claim→evidence linking partially exists.** `components/answer/source-citations.tsx`
   `CitationMarker` renders a hover tooltip (`SourcePreview`) with the source
   excerpt. The upgrade is *cross-highlighting into the evidence rail*, not
   building linking from zero.

3. **The pipeline trace is inert.** `components/answer/pipeline-trace.tsx` is a
   collapsed `<details>` dumping `JSON.stringify(step.input/output)` into `<pre>`
   tags at the bottom of the answer. This is the single biggest wow opportunity.

4. **Only one keyframe exists** (`case-progress` in `globals.css`); motion is
   otherwise absent. There is no motion library.

5. **Badge variants available:** `default, secondary, outline, success, warn,
   danger` (`components/ui/badge.tsx`). Reuse these; do not invent new ones
   unless a phase calls for it.

## 4. Dependencies to add

- `motion` (Framer Motion's current package; import from `motion/react`).
  Install: `npm install motion`.
- **Fonts** via `next/font` (no network dependency at runtime, self-hosted):
  - Display serif: **Fraunces** (variable, optical-size) — the editorial signature.
  - Body sans: **Inter** (or keep system stack if diff budget is tight; Inter
    recommended for consistent rendering across machines during the demo).
  Wire both in `app/layout.tsx` via `next/font/google`, expose as CSS variables
  `--font-display` and `--font-sans`, and reference them in the token layer.

## 5. Design language spec

### Type scale (set in `globals.css` `@theme` / base)
| Token | Usage | Spec |
|---|---|---|
| Display | Case-brief titles ("Answer ready") | Fraunces, 28–32px, `tracking-[-0.02em]`, optical size high |
| H2 | Section headers | Fraunces 20px or Inter 18px semibold |
| Eyebrow | existing `.eyebrow` | keep, but switch color to `--graphite`/muted |
| Body | claim text | Inter 15px / `leading-7` |
| Mono accent | citation chips, codes, scores | `ui-monospace` |

Keep the serif for *display headings only* — body stays sans. That contrast is
the editorial signature.

### Color (define these CSS vars to back the existing tailwind tokens)
Warm-neutral, low-chroma. Suggested starting values (tune in browser):
```
--paper:     #faf8f4;   /* page background, warm off-white */
--parchment: #f3efe7;   /* muted surface */
--ledger:    #ffffff;   /* card surface */
--graphite:  #2b2a27;   /* primary text, warm near-black */
--sage:      #5e7466;   /* success/calm accent */
--copper:    #9a6a3c;   /* literal-retrieval / warm highlight */
--signal:    #3f6f8f;   /* informational accent, links, active step */
--ember:     #b4452f;   /* review-needed / danger */
```
Map review/support states onto these (sage = ready/high, copper = medium/literal,
ember = needs-review/insufficient). Keep contrast AA.

### Depth & radius
- Cards use `shadow-panel` + `rounded-panel` (already in tailwind config). Replace
  ad-hoc `rounded-xl border border-zinc-200/80 bg-white/80` patterns gradually
  (Phase 5) with a shared surface token; do **not** mass-rename in Phase 0.

### Motion primitives (define once, reuse everywhere)
Create `lib/motion.ts` exporting shared variants/transitions so motion is
consistent and tunable from one place:
```ts
// lib/motion.ts
import type { Transition, Variants } from "motion/react";

export const ease = [0.16, 1, 0.3, 1] as const; // expo-out, calm settle

export const springSoft: Transition = { type: "spring", stiffness: 220, damping: 30 };

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
```
All animated lists use `staggerParent` + `fadeRise` children. Durations stay in
the 0.35–0.5s range — calm, not bouncy.

### Reduced motion
Add a single hook and gate every animation through it:
```ts
// lib/use-reduced-motion.ts is provided by motion: useReducedMotion()
```
Use `motion`'s built-in `useReducedMotion()`. When true, set transitions to
`{ duration: 0 }` and render content in final state (no transforms).

## 6. Implementation phases

Each phase is independently shippable and verifiable. Do them in order.

---

### Phase 0 — Foundation (tokens, fonts, motion primitives)

**Files:** `app/globals.css`, `app/layout.tsx`, `tailwind.config.ts` (verify
only), new `lib/motion.ts`.

1. Install `motion`. Add Fraunces + Inter via `next/font/google` in `layout.tsx`,
   exposing `--font-display` and `--font-sans` on `<body>`.
2. In `globals.css`, define the `--paper … --ember` variables from §5 inside
   `:root`. Repoint `body` background and font-family onto the warm token system.
   Keep the existing radial-gradient idea but retune to the warm palette so it
   reads intentional, not default.
3. Add `lib/motion.ts` (§5).
4. **Do not** restyle every component yet. Phase 0 only makes the tokens real and
   available. Verify the app still renders and `npm run verify` passes.

**Done when:** tokens resolve (inspect computed styles), fonts load, build passes,
no visual regressions beyond the new background/type.

---

### Phase 1 — Signature moment: the Living Pipeline reveal

Replace the inert `<details>` JSON dump with a vertical, choreographed timeline
that *plays* stage-by-stage when results arrive (client-side replay), and remains
inspectable afterward.

**New file:** `components/answer/pipeline-timeline.tsx`. **Edit:**
`components/AnswerPanel.tsx` (swap `<PipelineTrace>` usage; keep the old file or
delete after parity).

Behavior:
- On mount with a fresh `result`, animate steps in sequence: each step's node
  draws in (connector line grows, index badge pops, label + summary fade-rise),
  paced ~250–350ms apart. Use a `playhead` index advanced by `setTimeout`/effect,
  or `staggerChildren` if a single orchestrated entrance reads well enough.
- Status drives the node accent: `complete` → sage, `blocked` → ember, else signal
  (in-progress shimmer using the existing `case-progress` keyframe on the active
  node only).
- Each step stays expandable for the input/output JSON (preserve current
  inspectability — keep the `<pre>` detail, just inside the new visual node).
- Respect `useReducedMotion()`: render the full timeline instantly, no playhead.

Sketch:
```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { fadeRise, staggerParent } from "@/lib/motion";
import type { InvestigationResult } from "@/lib/types/investigation";

const statusAccent: Record<string, string> = {
  complete: "text-sage border-sage/30 bg-sage/5",
  blocked: "text-ember border-ember/30 bg-ember/5",
  pending: "text-signal border-signal/30 bg-signal/5",
};

export function PipelineTimeline({ result }: { result: InvestigationResult }) {
  const reduce = useReducedMotion();
  const steps = result.pipelineTrace;
  const [playhead, setPlayhead] = useState(reduce ? steps.length : 0);

  useEffect(() => {
    if (reduce) return;
    setPlayhead(0);
    const timers = steps.map((_, i) =>
      window.setTimeout(() => setPlayhead((p) => Math.max(p, i + 1)), i * 300),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [result.investigationId, reduce, steps.length]);

  if (!steps.length) return null;

  return (
    <section className="rounded-panel border bg-ledger/80 p-5 shadow-evidence">
      <p className="eyebrow">Pipeline</p>
      <motion.ol
        className="mt-4 grid gap-3"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        {steps.map((step, i) => (
          <motion.li
            key={step.id}
            variants={fadeRise}
            className={`relative grid grid-cols-[auto_1fr] gap-3 transition-opacity ${
              i < playhead ? "opacity-100" : "opacity-40"
            }`}
          >
            {/* connector + index node + label/summary + expandable JSON detail */}
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
```
**Done when:** running a ticket plays the pipeline reveal once, steps remain
inspectable, reduced-motion shows it instantly, parity with old trace content,
verify passes.

---

### Phase 2 — Signature moment: evidence ↔ claim cross-highlighting

Hovering/focusing a citation chip (`[S1]`, `[T1]`) highlights the matching chunk
in the evidence rail, and hovering an evidence chunk highlights the claims that
cite it. Shared hover state via lightweight context.

**New file:** `components/answer/active-citation-context.tsx`:
```tsx
"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{
  active: string | null;
  setActive: (id: string | null) => void;
}>({ active: null, setActive: () => {} });

export function ActiveCitationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  return <Ctx.Provider value={{ active, setActive }}>{children}</Ctx.Provider>;
}
export const useActiveCitation = () => useContext(Ctx);
```

Wiring:
- Wrap the result region in `SupportCopilotShell` (or `AnswerPanel` + its sibling
  `EvidencePanel`) with `ActiveCitationProvider` so both subtrees share state.
- `CitationMarker` (`source-citations.tsx`): add
  `onPointerEnter/onFocus={() => setActive(citation)}` and
  `onPointerLeave/onBlur={() => setActive(null)}`. Add a subtle ring when
  `active === citation`.
- Evidence rows in `EvidencePanel.tsx` (doc + tool): when `active === item.id`,
  apply an accent ring + `signal/copper` tinted surface and a brief
  `layout`/scale nudge via `motion`. Keep the existing `cited` badge logic.
- Keep the existing hover tooltip in `CitationMarker` — it complements, not
  replaces, the rail highlight.

**Done when:** hovering a citation lights the matching rail chunk (and reverse),
works via keyboard focus, no layout thrash, verify passes.

---

### Phase 3 — Signature moment: answer-assembly reveal

The customer reply and internal findings render with a staggered, calm entrance
so the answer feels *composed*, not dumped. Citation chips settle in slightly
after their claim text.

**Edit:** `components/AnswerPanel.tsx` `AnswerSection` / `InternalFindings`.

- Wrap claim lists in `motion.div` with `staggerParent`; each claim is a
  `fadeRise` child. Citation chips inside a claim get a tiny extra `delayChildren`.
- The case-brief header (title + status badges) fades-rise first, then the answer
  body, then evidence/pipeline — a top-to-bottom cascade that reads as assembly.
- Gate on `useReducedMotion()`.
- Important: only animate on a *new* result (`key={result.investigationId}` on
  the animated root) so re-renders (hover, mark-reviewed) don't re-trigger.

**Done when:** a fresh answer cascades in once per investigation; subsequent
interactions don't replay it; reduced-motion is instant; verify passes.

---

### Phase 4 — Signature moment: `needs_human_review` as a calm "stop"

Today the review block is a red card. Reframe as a deliberate, editorial moment
that signals *judgment*, not *error* — on-brand with the trust thesis.

**Edit:** the review-action `Card` in `AnswerPanel.tsx`.

- Use `ember` tones at low chroma on a `parchment` surface (not alarm red).
- Animate the icon in with `springSoft`; let the open-questions list stagger in.
- Strong display-serif headline ("This needs a human"), calm supporting copy.
- Keep all actions (retry-with-context, mark-reviewed) and acknowledged/retry
  states intact, including the emerald "acknowledged" styling — map it to `sage`.

**Done when:** review state reads as a calm, intentional checkpoint; all actions
and state transitions still work; verify passes.

---

### Phase 5 — Broad polish pass

Apply the foundation evenly so nothing looks left behind. Lower risk, do last.

- Replace repeated `rounded-xl border border-zinc-200/80 bg-white/80` with a
  shared `.surface` utility backed by `--ledger` + `shadow-evidence` +
  `rounded-panel`. Update `surface-shell` / `surface-muted` to the warm palette.
- Empty/loading/error states (`AnswerPanel` no-result + investigating, evidence
  rail quiet state, upload empty): replace plain text with calm skeletons /
  editorial empty states. Replace the "Investigating…" centered text with a
  subtle pipeline-preview shimmer so the wait previews the reveal.
- Micro-motion: button press/hover, badge appearance, card hover lift — all via
  the shared primitives, all subtle.
- Header (`SupportCopilotShell` top card): give it editorial treatment (serif
  wordmark, refined badge row).
- Sweep for remaining `zinc-*` hardcodes in the main flow and move to tokens.

**Done when:** the whole main flow reads as one crafted system; verify passes.

## 7. Accessibility checklist (every phase)

- [ ] All motion gated through `useReducedMotion()`.
- [ ] Citation cross-highlight reachable and visible via keyboard focus.
- [ ] Color contrast AA for text on warm surfaces (check `graphite` on `paper`,
      state accents on their tints).
- [ ] No information conveyed by color alone (keep status badges/labels).
- [ ] Animated reveals don't trap focus or delay interactivity.

## 8. Verification

After every phase:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
Full gate before declaring done: `npm run verify`.
Manual demo pass: run the 5 PayBridge sample tickets from `demo/tickets.json`
(see README "Canonical Demo Flow") and confirm the reveal, cross-highlight,
review state, and reduced-motion behavior on each.

## 9. Out of scope (YAGNI)

- Backend streaming / SSE.
- New data fields, new API routes, schema changes.
- Information-architecture changes (column layout, panel responsibilities).
- Dark mode (can be a follow-up; tokens make it cheap later).
- New component library or design-system package.

## 10. Suggested commit slicing

One commit per phase, conventional commits, e.g.:
- `feat(ui): wire editorial token system, fonts, motion primitives`
- `feat(answer): living pipeline timeline reveal`
- `feat(evidence): citation ↔ evidence cross-highlighting`
- `feat(answer): staggered answer-assembly reveal`
- `feat(answer): calm human-review checkpoint state`
- `style(ui): broad editorial polish pass`
