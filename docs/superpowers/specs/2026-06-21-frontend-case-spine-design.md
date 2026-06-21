# Frontend "Case Spine" — Design Spec

**Date:** 2026-06-21
**Status:** Approved design, ready for implementation planning
**Approach:** Case Spine (A) with light Dossier/Exhibit language (B)
**Aesthetic:** Editorial & calm base + one bold structural signature (the spine)
**Builds on:** current `main` (post hybrid-retrieval). Ports craft from the
`frontend-visual-craft` branch as reference, not as a merge base.

---

## 1. Goal

Rebuild the Support Copilot frontend as a single crafted system that is **both a
portfolio-grade showcase and a genuinely usable daily tool**. It must dazzle in a
~3-minute walkthrough *and* hold up under repeated real investigations.

Three decisions frame everything below (already settled with the user):

1. **Audience: both** — showcase that is also genuinely usable. Spectacle must
   survive daily use.
2. **Evidence is first-class for everyone** — the retrieved-evidence rail (the
   product's actual differentiator) is always visible, not hidden behind a debug
   flag.
3. **Aesthetic: editorial base + one bold signature** — keep the warm/calm/serif
   foundation; concentrate boldness in a single structural idea (the spine).

A fourth, user-stated pillar runs through the whole design:

4. **At every point, the user knows what to do.** Wayfinding and next-action
   clarity are first-class, not decoration.

We change *how the workspace is structured and how it guides the user*, without
changing backend contracts or data shapes.

## 2. Concept: the living Case Spine

The workspace is built around a **living Case Spine** — a narrow vertical backbone
running down the left of the canvas, with the investigation's stages as nodes:

```
Docs → Ticket → Retrieve → Route → Draft → Review
```

Before a run, the spine highlights the *setup* path (`Docs`, `Ticket`). During and
after a run, the *investigation* nodes (`Retrieve`, `Route`, `Draft`, `Review`)
light up in sequence as a client-side replay of `result.pipelineTrace[]`.

The spine serves three jobs at once:

- **Thesis made visible** — the whole pitch is "we show our work," so the work
  becomes the spatial skeleton everything hangs off, not a panel you scroll to.
- **Progress indicator** — where the investigation is, at a glance.
- **Primary wayfinding** — the active node anchors the single dominant next-action.

Evidence is framed in light **dossier language**: retrieved chunks and tool
outputs are numbered **Exhibits**; citations in the answer are literal
cross-references to them. The metaphor stays light — exhibit numbering and
linking — and never becomes skeuomorphic kitsch.

## 3. Information architecture: three zones

Three zones hang off the spine. This preserves the current three-part workflow
(history+upload / ticket+answer / evidence) while reframing it.

1. **Spine** (narrow left rail) — the living pipeline backbone plus the single
   source of "where am I / what's next." Setup stages pre-run, investigation
   stages during/after.
2. **Canvas** (center, widest) — the *active stage's* working surface:
   - Pre-run: upload dropzone + ticket composer.
   - Post-run: the answer **brief** (customer reply + internal findings).
   - The answer-assembly reveal plays here.
3. **Exhibits** (right rail, **always present / ungated**) — retrieved chunks +
   tool outputs as numbered exhibits, with citation ↔ exhibit cross-highlighting.

**Recent investigations** move from a permanent left-column card to a
**collapsible drawer** anchored off the spine top, so history stops competing with
the main flow.

Responsive behavior preserves the existing breakpoints' intent: below the wide
breakpoint, zones stack (spine collapses to a horizontal stepper at the top;
exhibits move below the canvas). The desktop/demo target is the three-zone layout.

## 4. The guidance system ("always know what to do")

Promoted from a subtle cue to a first-class pillar.

- **One dominant next-action, always**, anchored to the active spine node:
  `① Add support docs` → `② Paste the ticket` → `③ Run investigation` → post-run
  `Review the answer` or `This needs your judgment`. Exactly one primary CTA on
  screen at any moment; all secondary actions visually recede.
- **Reuse existing step logic.** `SupportCopilotShell` already computes
  `activeStep: "docs" | "ticket" | "investigate"` and threads `isActiveStep` into
  `UploadPanel` / `TicketForm`. We *promote* that from a subtle highlight into the
  spine's core mechanic rather than building step-tracking from zero.
- **Empty states are instructional, not decorative.** Each zone, when empty, says
  what belongs there and why it matters. Example — Exhibits rail pre-run:
  "Retrieved evidence will appear here. Every claim in the answer links back to
  it."
- **The run is narrated.** During investigation the spine advances stage-by-stage
  ("Retrieving…", "Routing…", "Drafting…") so the wait previews the reveal instead
  of being a dead spinner.

## 5. Aesthetic foundation (ported from `frontend-visual-craft`, refined)

This layer is already designed and implemented on the old branch; we re-apply it
onto `main`. See that branch's spec
(`docs/superpowers/specs/2026-06-17-frontend-visual-craft-design.md`) for the full
token table.

- **Tokens:** warm, low-chroma. Surfaces `paper` / `parchment` / `ledger`; text
  `graphite`; state accents `sage` (ready/high), `copper` (literal/medium),
  `signal` (active/info), `ember` (needs-review). Known gotcha to fix: these are
  declared in `tailwind.config.ts` but the CSS variables are **not** defined in
  `app/globals.css` (which currently runs a separate zinc/HSL system on
  "Avenir Next"). Wire the variables for real this time.
- **Type:** Fraunces (variable display serif, **headings only**) + Inter (body) via
  `next/font`, exposed as `--font-display` / `--font-sans`. Mono (`ui-monospace`)
  for citation chips, codes, and scores. Serif-display / sans-body contrast is the
  editorial signature.
- **Motion:** `lib/motion.ts` primitives — `fadeRise`, `staggerParent`,
  `springSoft`, expo-out `ease = [0.16, 1, 0.3, 1]`. Calm 0.35–0.5s, never bouncy.
  Add `motion` (`^12`, import from `motion/react`).
- **Depth/radius:** `shadow-panel` / `shadow-evidence`, `rounded-panel`. Shared
  `.surface` utility backed by `--ledger`, replacing ad-hoc
  `rounded-xl border border-zinc-200/80 bg-white/80`.

## 6. Signature moments

1. **The Case Spine reveal** *(headline signature; bolder than the old branch).*
   On a fresh result, the spine's investigation nodes draw in stage-by-stage
   (connector grows, node activates, label + summary settle), narrating
   `retrieve → route → draft → review`. This **replaces** the old branch's inert
   vertical timeline-in-a-panel by promoting it to the layout backbone. Status
   drives accent: `complete` → sage, `blocked` → ember, active → signal with a
   subtle shimmer (the existing `case-progress` keyframe) on the live node only.
   Each node stays expandable for input/output JSON behind the debug flag.
2. **Exhibit ↔ claim cross-highlighting.** Hover/focus a citation chip → its
   Exhibit lights in the rail (and reverse). Shared hover state via a lightweight
   React context; keyboard-reachable (markers are already `<button>`s). This is
   the old branch's Phase 2, kept intact and reframed in exhibit language.
3. **Answer-assembly cascade.** The brief composes in: case-brief header → claims →
   citation chips settling just after their claim text. Plays **once per
   investigation** (`key={result.investigationId}` on the animated root); never
   re-triggers on hover or mark-reviewed.
4. **`needs_human_review` as a calm checkpoint.** Reframed from a red error card to
   a deliberate "referred for judgment" moment: low-chroma `ember` on `parchment`,
   serif headline, `springSoft` icon entrance, open-questions list staggering in.
   Reads as judgment, not failure. All actions (retry-with-context, mark-reviewed)
   and acknowledged/retry states stay intact; map the "acknowledged" emerald to
   `sage`.

The bolder-than-the-branch delta is concentrated in #1: the pipeline stops being a
panel and becomes the spatial spine everything hangs off — which is also what makes
the wayfinding in §4 work.

## 7. Keep / remove / change

**Keep (the substance):**

- The full three-zone workflow and all states: evidence-only mode,
  `needs_human_review`, docs-gap report, retry-with-context, mark-reviewed,
  history, upload polling, demo scenarios.
- All backend contracts and `lib/types/investigation` shapes.
- The newer hybrid-retrieval work on `main` (the old branch predates it; we build
  on `main`).

**Remove / change:**

- **Retire the `NEXT_PUBLIC_DEBUG_RAG` gate on the evidence rail.** Exhibits are
  always-on. The flag is *demoted* to controlling only deep internals (raw
  input/output JSON, retrieval scores), not the rail's existence. (Today
  `SupportCopilotShell` renders `<EvidencePanel>` only when `showDebugToggle`; this
  changes.)
- **Demote `RecentInvestigations`** from a permanent left-column card to a
  collapsible drawer.
- **Drop the templated AI chrome** — the `<Sparkles />` + "Support workbench" badge
  masthead becomes a serif wordmark with a substance-led tagline.
- **Replace the inert `components/answer/pipeline-trace.tsx` `<details>` JSON
  dump** — superseded by the Case Spine. Raw JSON survives as an expandable detail
  inside each spine node, behind the debug flag.

## 8. Branch mechanics

- Fresh branch off current `main`: `frontend-case-spine`.
- **Port, don't merge.** Read the `frontend-visual-craft` files as reference
  (tokens, fonts, `lib/motion.ts`, cross-highlighting, review-state work) and
  re-apply them onto `main`. Do **not** merge or rebase `frontend-visual-craft` —
  it diverged before the hybrid-retrieval work and would fight `main`. The old
  branch becomes a reference artifact, not a base.

## 9. Hard constraints (do not violate)

- **No backend/API changes.** `/api/investigate` stays a single POST. The spine
  reveal is a **client-side replay** of `result.pipelineTrace[]` after the response
  lands. No SSE/streaming.
- **No data-shape changes**, no new API routes, no information-architecture
  additions beyond §3.
- **Accessibility:** every motion gated through `useReducedMotion()` /
  `prefers-reduced-motion` (reduced → final state, no transforms). Citation
  cross-highlight keyboard-reachable and visible on focus. AA contrast on warm
  surfaces. No information conveyed by color alone (keep status labels/badges).
- **Verification must pass:** `npm run verify` (lint, typecheck, format, test,
  build). Keep diffs reviewable.

## 10. Verification

- After each implementation slice: `npm run lint`, `npm run typecheck`,
  `npm run test`, `npm run build`. Full gate before done: `npm run verify`.
- **Manual demo pass:** run the 5 PayBridge sample tickets from `demo/tickets.json`
  and confirm, on each: the spine reveal plays once, exhibit ↔ claim
  cross-highlighting works (mouse and keyboard), the `needs_human_review`
  checkpoint reads as calm, the always-visible exhibits rail populates, the
  next-action guidance is correct at every step, and `prefers-reduced-motion`
  renders everything instantly.

## 11. Out of scope (YAGNI)

- Backend streaming / SSE; new data fields, routes, or schema changes.
- Information-architecture changes beyond the spine + drawer + ungated exhibits.
- Dark mode (tokens make it a cheap follow-up).
- A new component library or design-system package.
