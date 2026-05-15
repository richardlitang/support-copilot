# ADR 003: Explicit Human-Review Fallback

## Context

Support workflows are safety-sensitive. Incomplete evidence should not produce confident-sounding answers.

## Decision

Treat insufficient/contradictory evidence as a first-class state (`needs_human_review`) and produce a structured docs-gap report.

## Alternatives Considered

- Always draft a best-effort answer:
  Better surface continuity, weaker trust guarantees.
- Hard error without structured output:
  Safe but not operationally useful for next-step triage.

## Consequences

- System behavior is conservative by design.
- Product teams get reusable documentation gap artifacts.
- More cases route to human review, requiring explicit UX handling.
