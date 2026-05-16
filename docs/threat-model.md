# Threat Model

Support Copilot handles support tickets and internal product context. The primary security objective is to prevent sensitive data leakage while preserving investigation traceability.

## Assets

- Uploaded support documentation
- Ticket text
- Account context, feature flags, recent errors
- Investigation outputs (customer reply + internal diagnosis)
- Pipeline traces and operational logs
- Secrets (API keys, service-role credentials)

## Trust Boundaries

- Browser UI to Next.js API routes
- API routes to DB/queue/storage adapters
- Worker process to DB/storage/model providers
- Model provider responses back into validation and persistence

## Main Risks

1. Sensitive data leakage through logs or traces
2. Over-privileged client access to persistence tables/RPC
3. Hallucinated or over-broad model claims presented as facts
4. Unsafe fallback behavior when required context is missing
5. Partial-write persistence that leaves inconsistent investigation state

## Current Controls

- Server-side service-role access only; public table/RPC access revoked for `anon` and `authenticated`.
- Safe observability conventions: no raw document text, prompts, embeddings, secrets, headers, or cookies in logs/events.
- Structured claim validation:
  - citations must exist
  - unknown citations rejected
  - over-broad claims rejected
  - low-overlap claim/evidence rejected
- Deterministic review routing to `needs_human_review` for weak/conflicting/missing context.
- Atomic investigation persistence path through `create_investigation_run`.
- Offline eval suite checks routing/review/evidence invariants before build acceptance.

## Residual Risk

- Validation is heuristic and not formal entailment.
- Uploaded content may still contain sensitive details that operators must handle under policy.
- Third-party model/vendor outages can reduce quality/availability.
- Build-time dependency warnings (OpenTelemetry/Sentry transitive path) are non-fatal but should be monitored.

## Next Hardening Steps

1. Add red-team eval cases for prompt injection attempts in uploaded docs.
2. Add explicit PII pattern checks before persistence of user-visible outputs.
3. Add least-privilege DB roles per worker/API path if multi-tenant expansion occurs.
4. Add periodic audit of pipeline-event schema for accidental high-risk fields.
