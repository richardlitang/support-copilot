# RAG Contract Strategy

This project uses two complementary eval paths:

- `npm run eval:rag-contract`: deterministic regression contract with mocked retrieval/tool output and graph-wrapper parity checks.
- `npm run eval:demo`: live retrieval path with real retrieval and configured model/provider behavior.

## What The Contract Proves

- Route correctness: `docs_only`, `docs_plus_tools`, or `needs_human_review`.
- Review correctness: `ready` vs `needs_human_review`.
- Evidence floor: required doc/tool evidence counts and expected evidence keywords.
- Grounding guardrails: cited-claim expectations and forbidden-claim checks for known scenarios.
- Readiness metadata: expected ignored document statuses are present in `qualityCheck.retrieval`.
- Parity checks: direct pipeline output vs graph-wrapper output for mode/review decisions in offline runs.

## What The Contract Does Not Prove

- They do not prove semantic quality for every user phrasing.
- They do not benchmark reranker lift rigorously.
- Deterministic mode does not validate live retrieval quality against external services.

## Release Gates

Minimum local gate before shipping:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval:rag-contract
npm run build
```

Recommended pre-release gate:

```bash
npm run eval:demo
```

## Interpreting Failures

- Route mismatch: likely classifier or review-policy drift.
- Evidence-keyword miss with correct route: likely retrieval candidate/rerank drift.
- Offline parity mismatch: wrapper/direct pipeline logic divergence.
- Forbidden-claim failure: likely grounding or claim-validation regression.
- Live-only failures: environment/config drift or real retrieval quality regression.
