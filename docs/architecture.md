# Support Copilot Architecture

Support Copilot is a trust-first RAG support workbench. The core design goal is not "chat with files"; it is to make the retrieval, evidence, and fallback behavior inspectable enough that a reviewer can verify the system is grounded.

## Runtime Flow

1. **Upload and ingest**
   - The user uploads `.md`, `.txt`, or best-effort text-based `.pdf` files.
   - `app/api/upload/route.ts` parses files, chunks text, embeds each chunk, and persists document metadata plus vectors.
   - Raw files are not retained for the chunk-1/chunk-2 demo path.

2. **Retrieve**
   - `lib/retrieve.ts` embeds the pasted ticket and queries Supabase Postgres through pgvector.
   - Retrieved chunks become document evidence items with source IDs such as `S1`, `S2`, and `S3`.

3. **Classify**
   - `lib/classify.ts` deterministically routes the ticket into `docs_only`, `docs_plus_tools`, or `needs_human_review`.
   - This routing is deliberately rule-based instead of LLM-based so it is debuggable.

4. **Collect optional context**
   - `lib/tool-runner.ts` runs read-only support-context tools when the route requires them.
   - Tool outputs become separate evidence items with source IDs such as `T1`, `T2`, and `T3`.

5. **Generate structured claims**
   - `lib/answer.ts` asks OpenAI for structured output, not a freeform blob.
   - The app renders customer-facing reply and internal diagnosis from claim arrays.

6. **Validate and review**
   - Every claim must cite existing document or tool evidence.
   - `lib/support-level.ts`, `lib/review-policy.ts`, and `lib/conflict-policy.ts` decide support level and review state.
   - Weak, missing, or conflicting evidence routes to `needs_human_review` instead of bluffing.

7. **Persist and inspect**
   - `lib/db.ts` stores tickets, investigations, sources, tool calls, and structured JSON outputs.
   - The UI shows document evidence, tool evidence, and tool-call records separately.

## Key Boundaries

- `lib/ingest.ts`: upload-to-vector-store ingestion boundary.
- `lib/investigate.ts`: current direct orchestration boundary.
- `lib/evidence-builder.ts`: source registry and legacy compatibility helpers.
- `lib/tool-runner.ts`: deterministic tool execution and tool evidence construction.
- `lib/conflict-policy.ts`: policy for unresolved doc/tool state.
- `lib/types/investigation-v2.ts`: canonical structured investigation contract.

## Trust Model

The project relies on explicit artifacts instead of hidden reasoning:

- Claims are structured data.
- Citations map to concrete evidence IDs.
- Evidence is separated by source type.
- Support level is heuristic, not model self-confidence.
- Missing account/context evidence is a safe review state, not a UI blocker.
- Eval cases track expected route, review state, tool evidence, and broad retrieved-evidence keywords.

## Current Limitations

- The eval suite is useful but still shallow. It checks route shape and evidence presence more than semantic answer quality.
- DB writes are not yet transactional across all investigation rows.
- PDF parsing is best effort and should not be the primary demo path.
- Chunking has basic table preservation but is not a full layout-aware document parser.
- LangGraph is not implemented yet. The current architecture is prepared for it but intentionally stays direct until evals prove stability.

## Future Direction

The next major step is not "more agents." It is graph-orchestrated investigation:

```text
RetrieveDocumentation
  -> ClassifyInvestigation
  -> RunContextTools?
  -> BuildEvidenceRegistry
  -> GenerateClaimDraft
  -> ValidateGrounding
  -> ApplyReviewPolicy
  -> HumanReviewInterrupt?
  -> PersistInvestigation
```

LangGraph should be introduced behind a feature flag and proven against the direct pipeline with eval parity.
