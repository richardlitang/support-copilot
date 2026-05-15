# ADR 001: Deterministic Investigation Routing

## Context

Investigation mode selection (`docs_only`, `docs_plus_tools`, `needs_human_review`) is a high-impact control decision. An LLM-routed decision path would be harder to debug and harder to regression-test.

## Decision

Use deterministic routing rules in `lib/classify.ts` based on ticket shape, available evidence, and context signals.

## Alternatives Considered

- LLM-only route selection:
  Lower implementation effort, but non-deterministic and harder to test.
- Hybrid route selection:
  Improved flexibility, but still introduces non-deterministic control flow for a critical boundary.

## Consequences

- Routing is explainable and stable across runs.
- Evals can enforce route parity.
- New route intents require explicit rule updates.
