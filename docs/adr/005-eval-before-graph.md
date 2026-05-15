# ADR 005: Eval Parity Before Graph Runtime

## Context

Graph orchestration was planned as a future control-plane upgrade. Migrating too early risks introducing complexity without measurable correctness gains.

## Decision

Keep direct deterministic runtime as source-of-truth and maintain graph wrappers for parity checks until evals prove behavior parity and operational benefit.

## Alternatives Considered

- Immediate graph-runtime switch:
  Faster migration but riskier behavior drift.
- Delete all graph scaffolding:
  Simpler now, but loses incremental migration path.

## Consequences

- Runtime remains stable and inspectable.
- Some wrapper duplication exists and must be managed intentionally.
- Promotion to graph runtime requires explicit parity evidence.
