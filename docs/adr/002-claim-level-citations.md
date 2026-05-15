# ADR 002: Claim-Level Citations

## Context

Portfolio and production trust requirements both demand inspectable grounding. A single citation list for an entire answer makes it difficult to verify individual claims.

## Decision

Represent outputs as structured claims with per-claim citation IDs and reject uncited/unknown citations through validation.

## Alternatives Considered

- Freeform answer text with trailing citation list:
  Simpler UI but weak traceability.
- Full sentence-level provenance graph:
  Stronger semantics but high implementation and maintenance cost for this stage.

## Consequences

- Inspectability improves and reviewer confidence is higher.
- Validation/retry logic is more complex.
- UI must support source lookup and citation mapping ergonomically.
