# Portfolio Architecture Cleanup

## Goal

Make the repository easier to understand as a portfolio project by reducing duplicate-looking runtime paths and adding a concise code map.

## Architecture Overview

The active runtime remains the direct `src/server/investigation/investigate.ts` pipeline. duplicated claim-generation logic moves into a shared boundary. Direct ingestion is renamed to clarify that it supports seed/demo setup rather than the upload runtime.

## Tasks

1. Extract shared claim-generation branching from `src/server/investigation/investigate.ts` and `lib/claim-generation.ts` into `lib/claim-generation.ts`.
2. Rename `ingestParsedDocument` to `directIngestParsedDocument` and update seed/sample/tests.
3. Add `docs/code-map.md` with current runtime boundaries and reading order.
4. Update README and architecture docs to point reviewers at the code map.
5. Run typecheck, tests, and build before calling the cleanup complete.
