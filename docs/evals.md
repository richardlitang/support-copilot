# Eval Strategy

This project uses two complementary eval paths:

- `npm run eval:demo`: live retrieval path with real retrieval and configured model/provider behavior.
- `npm run eval:demo:offline`: deterministic parity path with mocked retrieval/tool output and graph-wrapper parity checks.

## What These Evals Prove

- Route correctness: `docs_only`, `docs_plus_tools`, or `needs_human_review`.
- Review correctness: `ready` vs `needs_human_review`.
- Evidence floor: required doc/tool evidence counts and expected evidence keywords.
- Parity checks: direct pipeline output vs graph-wrapper output for mode/review decisions in offline runs.

## What These Evals Do Not Prove

- They do not prove semantic quality for every user phrasing.
- They do not benchmark reranker lift rigorously.
- Offline mode does not validate real retrieval quality.

## Release Gates

Minimum local gate before shipping:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run eval:demo:offline
```

Recommended pre-release gate:

```bash
npm run eval:demo
```

## Interpreting Failures

- Route mismatch: likely classifier or review-policy drift.
- Evidence-keyword miss with correct route: likely retrieval candidate/rerank drift.
- Offline parity mismatch: wrapper/direct pipeline logic divergence.
- Live-only failures: environment/config drift or real retrieval quality regression.
