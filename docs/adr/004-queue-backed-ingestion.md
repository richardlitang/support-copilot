# ADR 004: Queue-Backed Document Ingestion

## Context

Upload parsing/chunking/embedding can be slow and variable. Doing all ingestion inline in the request handler increases latency and failure coupling.

## Decision

Accept uploads quickly, persist raw objects/metadata, and process ingestion asynchronously via BullMQ worker.

## Alternatives Considered

- Fully synchronous ingestion in `/api/upload`:
  Simpler path, worse latency and resilience.
- External workflow/orchestration service:
  Scalable but overkill for current scope.

## Consequences

- Upload UX is responsive and failure isolation improves.
- Requires Redis and worker process in local/prod setup.
- Document status lifecycle (`uploaded` -> `processing` -> `ready`/`failed`) becomes central to UI and tests.
