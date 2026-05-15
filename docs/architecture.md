# Support Copilot Architecture

Support Copilot is a trust-first RAG support workbench. The core design goal is not "chat with files"; it is to make the retrieval, evidence, and fallback behavior inspectable enough that a reviewer can verify the system is grounded.

For a file-oriented map of frontend, backend, worker, and test/demo code, see [`docs/code-map.md`](code-map.md).

## Runtime Flow

1. **Upload and ingest**
   - The user uploads `.md`, `.txt`, or best-effort text-based `.pdf` files.
   - `app/api/upload/route.ts` parses files, chunks text, embeds each chunk, and persists document metadata plus vectors.
   - Raw files are not retained for the chunk-1/chunk-2 demo path.

2. **Retrieve**
   - `lib/retrieve.ts` embeds the pasted ticket and queries Supabase Postgres through pgvector.
   - `lib/literal-retrieval.ts` extracts likely exact literals such as error codes, snake_case product strings, and object IDs.
   - Literal matches expand the candidate set before ranking so exact support tokens can enter the evidence pool even when dense retrieval ranks them poorly.
   - If `COHERE_API_KEY` is configured, `lib/rerank.ts` reranks the merged candidate set before final evidence selection.
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
   - `lib/docs-gap-report.ts` turns failed or weak-support runs into a structured docs-gap report.

7. **Persist and inspect**
   - `lib/db.ts` stores tickets, investigations, sources, tool calls, and structured JSON outputs.
   - Current-schema deployments use `create_investigation_run` to write the ticket, investigation, source links, and tool-call rows in one database transaction.
   - The UI shows document evidence, tool evidence, and tool-call records separately.

## Key Boundaries

- `lib/ingest.ts`: direct seed/demo ingestion helper for deterministic local setup.
- `lib/investigate.ts`: current direct orchestration boundary.
- `lib/claim-generation.ts`: shared claim-generation boundary used by the direct pipeline and graph-node parity wrappers.
- `lib/evidence-builder.ts`: source registry and claim/evidence formatting helpers.
- `lib/tool-runner.ts`: deterministic tool execution and tool evidence construction.
- `lib/conflict-policy.ts`: policy for unresolved doc/tool state.
- `lib/types/investigation.ts`: canonical structured investigation contract.

## Trust Model

The project relies on explicit artifacts instead of hidden reasoning:

- Claims are structured data.
- Citations map to concrete evidence IDs.
- Evidence is separated by source type.
- Document evidence records whether it came from vector retrieval, literal expansion, or both, and whether it was reranked.
- Support level is heuristic, not model self-confidence.
- Missing account/context evidence is a safe review state, not a UI blocker.
- Eval cases track expected route, review state, tool evidence, and broad retrieved-evidence keywords.
- Supabase reads and writes happen through server-side service-role adapters; public table access and RPC execution are revoked from `anon` and `authenticated` roles.

## Current Limitations

- The eval suite is useful but still shallow. It checks route shape and evidence presence more than full semantic answer quality or reranker lift.
- Claim validation now catches uncited output, unknown citation labels, over-broad claims, and claims with no meaningful token overlap with cited evidence. It is a guardrail, not a proof of entailment.
- Atomic investigation persistence depends on applying the latest Supabase migration; older schemas fail with an explicit migration error instead of silently falling back.
- PDF parsing is best effort and should not be the primary demo path.
- Chunking has basic table preservation but is not a full layout-aware document parser.
- Literal expansion currently uses simple Postgres `ILIKE` matching. Trigram or full-text retrieval should be added only if evals show missed literal/prose cases.
- LangGraph is not implemented yet. `lib/graph/**` contains parity wrappers around deterministic modules, but the runtime intentionally stays direct until evals prove stability.

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
