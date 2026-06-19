# Hybrid Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve documentation answer recall for exact support codes and natural-language queries by adding measured hybrid retrieval: pinned exact-code hits, RRF fusion, an English FTS lane, and recall metrics at the reranker input and final output boundaries.

**Architecture:** Retrieval will have three lanes with separate responsibilities. Exact-code hits are deterministic and pinned into reserved reranker slots. Vector and FTS candidates are contestable and fused with reciprocal rank fusion (RRF), then capped before Cohere. Evals measure whether gold evidence reaches the reranker input and whether it survives the final rerank output.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase/Postgres, pgvector, Postgres full-text search, Cohere rerank through the existing reranker adapter.

## Global Constraints

- Do not add an external search service for this slice.
- Do not add a new dependency unless the current Postgres FTS path is proven insufficient by the evals.
- Keep exact-code retrieval separate from natural-language FTS.
- Do not use raw score blending between vector, literal, and FTS scores.
- RRF must sum per chunk across lanes before selecting contestable candidates.
- Exact-code candidates must be pinned outside the RRF contest and must be exempt from truncation until their reserved slot budget is filled.
- Hosted Supabase and direct Postgres retrieval paths must expose the same searchable fields.
- Gold eval references must use stable text/filename expectations, not chunk IDs, because parser cleanup and reingestion can change chunk IDs.
- Each implementation task must end with a focused verification command and a conventional commit.

## File Map

- `lib/literal-retrieval.ts`: split code-shaped literal extraction from short-question lexical fallback.
- `lib/retrieval-candidates.ts`: replace score-based merge with pinned candidate selection and RRF fusion helpers.
- `lib/types.ts`: extend retrieval source metadata for `exact`, `vector`, `fts`, and `hybrid`.
- `src/server/retrieval/retrieve.ts`: orchestrate lane execution, pinning, RRF, reranker input cap, Cohere rerank, and optional trace data.
- `src/server/db/chunks.ts`: direct Postgres implementations for literal and FTS matching.
- `src/server/db/retrieval.ts`: hosted Supabase implementations for literal and FTS matching.
- `src/server/config/env.ts`: add typed reranker candidate cap and pinned slot config if the existing env helper pattern supports it.
- `supabase/migrations/*_hybrid_retrieval_fts.sql`: add FTS index and RPC.
- `scripts/run-retrieval-evals.ts`: new retrieval-boundary eval runner.
- `scripts/evals/types.ts`: add retrieval eval case and summary types.
- `demo/retrieval-evals.json`: fixed failure-slice eval set.
- `tests/retrieval/*.test.ts`: unit tests for extraction, fusion, pinning, and cap behavior.
- `tests/db/*.test.ts` or existing db test location: tests for direct/hosted literal field parity if practical with current test harness.

## Target Interfaces

These interfaces are the contract for the later tasks:

```ts
export type RetrievalLane = "exact" | "vector" | "fts";

export type RetrievalLaneCandidate = EvidenceChunk & {
  lane: RetrievalLane;
  laneRank: number;
  exactPinned?: boolean;
  exactMatches?: string[];
  ftsScore?: number;
};

export type RetrievalBoundaryTrace = {
  query: string;
  exactTerms: string[];
  ftsQuery: string;
  pinnedCandidateIds: string[];
  rerankerInputCandidateIds: string[];
  finalCandidateIds: string[];
};
```

The final `EvidenceChunk.retrievalSource` values should be derived from lane participation:

```ts
type RetrievalSource = "exact" | "vector" | "fts" | "hybrid";
```

## Task 1: Add Retrieval Recall Eval Fixtures

**Files:**
- Create: `demo/retrieval-evals.json`
- Modify: `scripts/evals/types.ts`

**Interfaces:**
- Produces `RetrievalEvalCase` for the new eval runner.

- [ ] **Step 1: Add retrieval eval types**

Add these exports to `scripts/evals/types.ts`:

```ts
export type RetrievalEvalSlice = "code" | "natural_language" | "semantic";

export type RetrievalGoldExpectation = {
  filenameIncludes?: string;
  sectionTitleIncludes?: string;
  contentIncludes: string[];
};

export type RetrievalEvalCase = {
  id: string;
  slice: RetrievalEvalSlice;
  query: string;
  sessionId?: string;
  expectedGold: RetrievalGoldExpectation;
};

export type RetrievalEvalSummary = {
  id: string;
  slice: RetrievalEvalSlice;
  query: string;
  inputRecallPassed: boolean;
  outputRecallPassed: boolean;
  rerankerInputCount: number;
  finalCount: number;
  matchedInputIds: string[];
  matchedFinalIds: string[];
};
```

- [ ] **Step 2: Add the fixed eval set**

Create `demo/retrieval-evals.json`:

```json
[
  {
    "id": "code_duplicate_payment_attempt",
    "slice": "code",
    "query": "duplicate_payment_attempt what does it mean",
    "expectedGold": {
      "filenameIncludes": "PayBridge API Support Guide",
      "contentIncludes": [
        "duplicate_payment_attempt",
        "second payment attempt",
        "already has a successful payment"
      ]
    }
  },
  {
    "id": "code_webhook_signature_failed",
    "slice": "code",
    "query": "webhook_signature_failed",
    "expectedGold": {
      "contentIncludes": ["webhook_signature_failed"]
    }
  },
  {
    "id": "natural_language_ach_payment",
    "slice": "natural_language",
    "query": "what is ach payment",
    "expectedGold": {
      "contentIncludes": ["ACH", "payment"]
    }
  },
  {
    "id": "natural_language_duplicate_payment_meaning",
    "slice": "natural_language",
    "query": "what does a duplicate payment attempt mean",
    "expectedGold": {
      "contentIncludes": ["duplicate", "payment", "successful payment"]
    }
  }
]
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add demo/retrieval-evals.json scripts/evals/types.ts
git commit -m "test(retrieval): add recall eval fixtures" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 2: Expose Retrieval Boundary Trace

**Files:**
- Modify: `src/server/retrieval/retrieve.ts`

**Interfaces:**
- Consumes `RetrievalBoundaryTrace`.
- Produces optional trace data without changing current callers.

- [ ] **Step 1: Add an optional trace callback to `retrieveEvidence`**

Change the input type to:

```ts
export async function retrieveEvidence(input: {
  question: string;
  sessionId: string;
  limit?: number;
  onTrace?: (trace: RetrievalBoundaryTrace) => void;
}) {
```

- [ ] **Step 2: Emit current baseline trace**

After candidates are merged and after final candidates are selected, call:

```ts
input.onTrace?.({
  query: input.question,
  exactTerms: literals,
  ftsQuery: "",
  pinnedCandidateIds: [],
  rerankerInputCandidateIds: candidates.map((candidate) => candidate.id),
  finalCandidateIds: finalCandidates.map((candidate) => candidate.id),
});
```

The first implementation can report all current merged candidates as the reranker input because Cohere currently receives all merged candidates.

- [ ] **Step 3: Add a focused unit test**

Create or update `tests/retrieval/retrieve-trace.test.ts` to assert:

```ts
expect(trace.rerankerInputCandidateIds).toContain("gold-chunk");
expect(trace.finalCandidateIds.length).toBeLessThanOrEqual(8);
```

Use dependency mocking consistent with existing Vitest patterns in this repo.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/retrieval/retrieve-trace.test.ts`

Expected: the new trace test passes.

- [ ] **Step 5: Commit**

```bash
git add src/server/retrieval/retrieve.ts tests/retrieval/retrieve-trace.test.ts
git commit -m "test(retrieval): expose reranker boundary trace" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 3: Unify Direct and Hosted Literal Search Fields

**Files:**
- Modify: `src/server/db/chunks.ts`
- Modify or create test: `tests/retrieval/literal-retrieval.test.ts`

**Interfaces:**
- Direct path must search both `document_chunks.content` and `document_chunks.section_title`, matching `src/server/db/retrieval.ts`.

- [ ] **Step 1: Add a regression test for title-only literal hits**

Add a test case that describes the contract:

```ts
it("searches section titles as well as content for literal matches", () => {
  const sql = directLiteralSearchSqlForTest();

  expect(sql).toContain("document_chunks.content ilike");
  expect(sql).toContain("document_chunks.section_title ilike");
});
```

If no SQL extraction helper exists, first extract the direct literal SQL into a named exported-for-test string:

```ts
export const DIRECT_LITERAL_DOCUMENT_CHUNKS_SQL = `
  select
    document_chunks.id,
    document_chunks.document_id,
    documents.filename,
    document_chunks.section_title,
    document_chunks.content,
    document_chunks.chunk_index
  from document_chunks
  inner join documents on documents.id = document_chunks.document_id
  where documents.session_id = $1
    and documents.status = 'ready'
    and (
      document_chunks.content ilike $2
      or document_chunks.section_title ilike $2
    )
  limit $3
`;
```

- [ ] **Step 2: Use the extracted SQL in `matchLiteralDocumentChunksDirect`**

Replace the inline SQL query with `DIRECT_LITERAL_DOCUMENT_CHUNKS_SQL`.

- [ ] **Step 3: Verify**

Run: `npm test -- tests/retrieval/literal-retrieval.test.ts`

Expected: literal retrieval tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/chunks.ts tests/retrieval/literal-retrieval.test.ts
git commit -m "fix(retrieval): search titles in direct literal path" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 4: Build Baseline Retrieval Recall Runner

**Files:**
- Create: `scripts/run-retrieval-evals.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `demo/retrieval-evals.json`.
- Uses `retrieveEvidence({ onTrace })`.
- Reports `inputRecallPassed` and `outputRecallPassed` separately.

- [ ] **Step 1: Implement gold matching**

Create a helper in `scripts/run-retrieval-evals.ts`:

```ts
function matchesGold(candidate: EvidenceChunk, expected: RetrievalGoldExpectation) {
  const filenamePassed =
    !expected.filenameIncludes ||
    candidate.filename.toLowerCase().includes(expected.filenameIncludes.toLowerCase());
  const sectionTitlePassed =
    !expected.sectionTitleIncludes ||
    (candidate.sectionTitle ?? "")
      .toLowerCase()
      .includes(expected.sectionTitleIncludes.toLowerCase());
  const content = candidate.content.toLowerCase();
  const contentPassed = expected.contentIncludes.every((part) =>
    content.includes(part.toLowerCase()),
  );

  return filenamePassed && sectionTitlePassed && contentPassed;
}
```

- [ ] **Step 2: Resolve input and final candidates**

Use trace IDs to compute input recall and returned evidence to compute final recall:

```ts
const inputRecallPassed = inputCandidates.some((candidate) =>
  matchesGold(candidate, testCase.expectedGold),
);
const outputRecallPassed = finalCandidates.some((candidate) =>
  matchesGold(candidate, testCase.expectedGold),
);
```

The runner should print JSON summaries and exit 1 when any case fails.

- [ ] **Step 3: Add package script**

Add to `package.json`:

```json
"eval:retrieval": "node --import tsx scripts/run-retrieval-evals.ts"
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`

Expected: exit code 0.

Run against a seeded database when available:

```bash
npm run eval:retrieval
```

Expected baseline: code and natural-language slices may fail before the hybrid upgrade, but the runner must produce per-case input/output recall summaries.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/run-retrieval-evals.ts
git commit -m "test(retrieval): measure reranker boundary recall" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 5: Split Exact-Code Extraction From Lexical Fallback

**Files:**
- Modify: `lib/literal-retrieval.ts`
- Modify: `tests/retrieval/literal-retrieval.test.ts`

**Interfaces:**
- Produces `extractExactCodeLiterals(input: string): string[]`.
- Keeps `extractLikelyLiterals(input: string): string[]` temporarily for backwards compatibility until the FTS lane is live.

- [ ] **Step 1: Add exact-code tests**

Add assertions:

```ts
expect(extractExactCodeLiterals("duplicate_payment_attempt what does it mean")).toEqual([
  "duplicate_payment_attempt",
]);
expect(extractExactCodeLiterals("ERR-4021-X failed")).toEqual(["ERR-4021-X"]);
expect(extractExactCodeLiterals("what is ach payment")).toEqual([]);
```

- [ ] **Step 2: Implement exact extractor**

Add:

```ts
const exactCodePatterns = [
  /`([^`]+)`/g,
  /\b[A-Z]{2,}[-_][A-Z0-9_-]+\b/g,
  /\b[A-Z]+-\d+[A-Z0-9-]*\b/g,
  /\b[a-z]+_[a-z0-9_]+\b/g,
  /\b[a-z0-9]+_id\b/gi,
];

export function extractExactCodeLiterals(input: string) {
  const literals = new Set<string>();

  for (const pattern of exactCodePatterns) {
    for (const match of input.matchAll(pattern)) {
      const literal = normalizeLiteral(match[1] ?? match[0]);

      if (literal.length < 4 || GENERIC_LITERAL_TOKENS.has(literal.toUpperCase())) {
        continue;
      }

      literals.add(literal);
    }
  }

  return Array.from(literals).slice(0, 8);
}
```

- [ ] **Step 3: Keep current fallback wired through `extractLikelyLiterals`**

Make `extractLikelyLiterals` start from `extractExactCodeLiterals(input)` and then apply the existing short-question fallback only when no exact codes were found.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/retrieval/literal-retrieval.test.ts`

Expected: extraction and merge tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/literal-retrieval.ts tests/retrieval/literal-retrieval.test.ts
git commit -m "refactor(retrieval): split exact code extraction" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 6: Add Reranker Input Cap and Pinned Exact Slots

**Files:**
- Modify: `src/server/retrieval/retrieve.ts`
- Modify: `lib/retrieval-candidates.ts`
- Modify: `tests/retrieval/literal-retrieval.test.ts`

**Interfaces:**
- Produces `getRerankCandidateLimit(): number`.
- Produces `getPinnedExactCandidateLimit(): number`.
- Produces `selectRerankerInputCandidates(...)`.

- [ ] **Step 1: Add cap helper tests**

Assert defaults and bounds:

```ts
expect(getRerankCandidateLimit()).toBe(50);
expect(getPinnedExactCandidateLimit()).toBe(5);
```

Use env override tests for lower and upper clamp behavior.

- [ ] **Step 2: Add candidate selection tests**

Add a test with 2 exact candidates and 60 contestable candidates:

```ts
const selected = selectRerankerInputCandidates({
  exactCandidates,
  contestableCandidates,
  limit: 10,
  pinnedExactLimit: 5,
});

expect(selected.slice(0, 2).map((candidate) => candidate.id)).toEqual(["exact-1", "exact-2"]);
expect(selected).toHaveLength(10);
```

- [ ] **Step 3: Implement selection helper**

In `lib/retrieval-candidates.ts`:

```ts
export function selectRerankerInputCandidates(input: {
  exactCandidates: EvidenceChunk[];
  contestableCandidates: EvidenceChunk[];
  limit: number;
  pinnedExactLimit: number;
}) {
  const selected = new Map<string, EvidenceChunk>();
  const pinned = input.exactCandidates.slice(0, input.pinnedExactLimit);

  for (const candidate of pinned) {
    selected.set(candidate.id, {
      ...candidate,
      exactPinned: true,
      retrievalSource: candidate.retrievalSource ?? "exact",
    });
  }

  for (const candidate of input.contestableCandidates) {
    if (selected.size >= input.limit) {
      break;
    }
    if (!selected.has(candidate.id)) {
      selected.set(candidate.id, candidate);
    }
  }

  return Array.from(selected.values()).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}
```

- [ ] **Step 4: Wire cap before Cohere**

In `retrieveEvidence`, call Cohere with `rerankerInputCandidates`, not the full merged list.

- [ ] **Step 5: Verify**

Run: `npm test -- tests/retrieval/literal-retrieval.test.ts`

Expected: selection tests pass.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/retrieval-candidates.ts src/server/retrieval/retrieve.ts tests/retrieval/literal-retrieval.test.ts
git commit -m "feat(retrieval): pin exact hits before rerank cap" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 7: Replace Score Merge With RRF for Contestable Lanes

**Files:**
- Modify: `lib/retrieval-candidates.ts`
- Modify: `tests/retrieval/literal-retrieval.test.ts`
- Modify: `src/server/retrieval/retrieve.ts`

**Interfaces:**
- Produces `fuseRetrievalCandidatesWithRrf(lanes, rrfK)`.

- [ ] **Step 1: Add RRF tests before implementation**

Add:

```ts
const fused = fuseRetrievalCandidatesWithRrf(
  [
    { lane: "vector", candidates: [chunk("shared", 1), chunk("vector-only", 2)] },
    { lane: "fts", candidates: [chunk("fts-only", 1), chunk("shared", 2)] },
  ],
  60,
);

expect(fused[0]?.id).toBe("shared");
expect(fused[0]?.retrievalSource).toBe("hybrid");
```

- [ ] **Step 2: Implement canonical RRF**

Use chunk ID as the dedupe key and sum contributions before sorting:

```ts
export function fuseRetrievalCandidatesWithRrf(
  lanes: Array<{ lane: "vector" | "fts"; candidates: EvidenceChunk[] }>,
  rrfK = 60,
) {
  const byId = new Map<
    string,
    EvidenceChunk & { rrfScore: number; laneNames: Set<"vector" | "fts"> }
  >();

  for (const lane of lanes) {
    lane.candidates.forEach((candidate, index) => {
      const contribution = 1 / (rrfK + index + 1);
      const existing = byId.get(candidate.id);

      if (existing) {
        existing.rrfScore += contribution;
        existing.laneNames.add(lane.lane);
        return;
      }

      byId.set(candidate.id, {
        ...candidate,
        rrfScore: contribution,
        laneNames: new Set([lane.lane]),
      });
    });
  }

  return Array.from(byId.values())
    .sort((left, right) => right.rrfScore - left.rrfScore)
    .map((candidate, index) => ({
      ...candidate,
      score: candidate.rrfScore,
      retrievalSource: candidate.laneNames.size > 1 ? "hybrid" : Array.from(candidate.laneNames)[0],
      rank: index + 1,
    }));
}
```

- [ ] **Step 3: Wire RRF into `retrieveEvidence`**

Use RRF for contestable candidates, then pass the result into `selectRerankerInputCandidates`.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/retrieval/literal-retrieval.test.ts`

Expected: RRF tests pass.

Run: `npm run eval:rag-contract`

Expected: existing offline RAG contract remains green.

- [ ] **Step 5: Commit**

```bash
git add lib/retrieval-candidates.ts src/server/retrieval/retrieve.ts tests/retrieval/literal-retrieval.test.ts
git commit -m "feat(retrieval): fuse contestable candidates with rrf" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 8: Add Postgres FTS Index and RPC

**Files:**
- Create: `supabase/migrations/20260619000000_hybrid_retrieval_fts.sql`

**Interfaces:**
- Produces RPC `match_fts_document_chunks(session_id_filter uuid, query_text text, match_count int)`.

- [ ] **Step 1: Add SQL migration**

Create:

```sql
create index if not exists document_chunks_fts_english_idx
on public.document_chunks
using gin (
  to_tsvector(
    'english',
    coalesce(section_title, '') || ' ' || coalesce(content, '')
  )
);

create or replace function public.match_fts_document_chunks(
  session_id_filter uuid,
  query_text text,
  match_count int default 50
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  section_title text,
  content text,
  score real,
  chunk_index int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with query as (
    select websearch_to_tsquery('english', query_text) as tsq
  )
  select
    document_chunks.id,
    document_chunks.document_id,
    documents.filename,
    document_chunks.section_title,
    document_chunks.content,
    ts_rank_cd(
      to_tsvector(
        'english',
        coalesce(document_chunks.section_title, '') || ' ' || coalesce(document_chunks.content, '')
      ),
      query.tsq
    )::real as score,
    document_chunks.chunk_index
  from public.document_chunks
  inner join public.documents on documents.id = document_chunks.document_id
  cross join query
  where documents.session_id = session_id_filter
    and documents.status = 'ready'
    and query.tsq @@ to_tsvector(
      'english',
      coalesce(document_chunks.section_title, '') || ' ' || coalesce(document_chunks.content, '')
    )
  order by score desc, document_chunks.chunk_index asc
  limit match_count;
$$;
```

- [ ] **Step 2: Verify migration syntax locally**

Run the project migration command against local or hosted dev database:

```bash
npm run db:migrate
```

Expected: migration applies once and is idempotent on rerun.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619000000_hybrid_retrieval_fts.sql
git commit -m "feat(db): add document chunk fts retrieval" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 9: Add Hosted and Direct FTS Retrieval Functions

**Files:**
- Modify: `src/server/db/chunks.ts`
- Modify: `src/server/db/retrieval.ts`
- Modify or create: `tests/retrieval/fts-retrieval.test.ts`

**Interfaces:**
- Produces `matchFtsDocumentChunksDirect`.
- Produces `matchFtsDocumentChunksDb`.

- [ ] **Step 1: Add the function signatures**

```ts
export async function matchFtsDocumentChunksDb(input: {
  sessionId: string;
  query: string;
  matchCount: number;
}): Promise<EvidenceChunk[]>;
```

```ts
export async function matchFtsDocumentChunksDirect(input: {
  sessionId: string;
  query: string;
  matchCount: number;
}): Promise<EvidenceChunk[]>;
```

- [ ] **Step 2: Implement hosted RPC call**

Use Supabase RPC:

```ts
const { data, error } = await supabase.rpc("match_fts_document_chunks", {
  session_id_filter: input.sessionId,
  query_text: input.query,
  match_count: input.matchCount,
});
```

Map rows to `EvidenceChunk` with `retrievalSource: "fts"` and `ftsScore: row.score`.

- [ ] **Step 3: Implement direct RPC call**

Use direct SQL:

```sql
select *
from match_fts_document_chunks($1, $2, $3)
```

Parameters: `[input.sessionId, input.query, input.matchCount]`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`

Expected: exit code 0.

Run any new focused test:

```bash
npm test -- tests/retrieval/fts-retrieval.test.ts
```

Expected: function contracts and mapping pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/chunks.ts src/server/db/retrieval.ts tests/retrieval/fts-retrieval.test.ts
git commit -m "feat(retrieval): add fts candidate lane" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 10: Wire FTS Lane Into Retrieval

**Files:**
- Modify: `src/server/retrieval/retrieve.ts`
- Modify: `tests/retrieval/retrieve-trace.test.ts`

**Interfaces:**
- FTS candidates feed RRF with vector candidates.
- Exact candidates remain pinned and outside RRF.

- [ ] **Step 1: Import and call FTS matcher**

In `retrieveEvidence`, add:

```ts
const ftsCandidates = await matchFtsDocumentChunks({
  sessionId: input.sessionId,
  query: input.question,
  matchCount: getFtsCandidateLimit(),
});
```

- [ ] **Step 2: Fuse vector and FTS only**

```ts
const contestableCandidates = fuseRetrievalCandidatesWithRrf([
  { lane: "vector", candidates: vectorCandidates },
  { lane: "fts", candidates: ftsCandidates },
]);

const rerankerInputCandidates = selectRerankerInputCandidates({
  exactCandidates,
  contestableCandidates,
  limit: getRerankCandidateLimit(),
  pinnedExactLimit: getPinnedExactCandidateLimit(),
});
```

- [ ] **Step 3: Update trace assertions**

Assert trace reports pinned IDs and capped reranker input IDs:

```ts
expect(trace.pinnedCandidateIds).toContain("exact-1");
expect(trace.rerankerInputCandidateIds).toHaveLength(50);
```

- [ ] **Step 4: Verify**

Run: `npm test -- tests/retrieval/retrieve-trace.test.ts tests/retrieval/literal-retrieval.test.ts`

Expected: focused retrieval tests pass.

Run: `npm run eval:rag-contract`

Expected: offline RAG contract passes.

- [ ] **Step 5: Commit**

```bash
git add src/server/retrieval/retrieve.ts tests/retrieval/retrieve-trace.test.ts
git commit -m "feat(retrieval): rerank hybrid fts candidates" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 11: Narrow Literal Lane to Exact Codes Only

**Files:**
- Modify: `src/server/retrieval/retrieve.ts`
- Modify: `lib/literal-retrieval.ts`
- Modify: `tests/retrieval/literal-retrieval.test.ts`

**Interfaces:**
- Retrieval must use `extractExactCodeLiterals` for the pinned exact lane.
- `extractLikelyLiterals` can remain exported for compatibility tests but must no longer be used by `retrieveEvidence`.

- [ ] **Step 1: Add regression tests**

Add:

```ts
expect(extractExactCodeLiterals("what is ach payment")).toEqual([]);
expect(extractLikelyLiterals("what is ach payment")).toEqual(["ACH", "payment"]);
```

The first assertion proves the exact lane is narrow. The second keeps old behavior visible until the fallback is removed in a future cleanup.

- [ ] **Step 2: Switch retrieval to exact extraction**

In `retrieveEvidence`:

```ts
const exactLiterals = extractExactCodeLiterals(input.question);
const exactCandidates = exactLiterals.length
  ? await matchLiteralDocumentChunks({
      sessionId: input.sessionId,
      literals: exactLiterals,
      matchCount: getPinnedExactCandidateLimit(),
    })
  : [];
```

- [ ] **Step 3: Verify**

Run: `npm test -- tests/retrieval/literal-retrieval.test.ts tests/retrieval/retrieve-trace.test.ts`

Expected: exact-code and trace tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/literal-retrieval.ts src/server/retrieval/retrieve.ts tests/retrieval/literal-retrieval.test.ts
git commit -m "refactor(retrieval): reserve literal lane for exact codes" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Task 12: Run Recall Evals and Full Verification

**Files:**
- Modify only if eval output exposes a defect in earlier tasks.

**Interfaces:**
- Confirms code slice does not regress.
- Confirms natural-language slice improves from baseline.
- Confirms final answer quality still passes existing contract.

- [ ] **Step 1: Run retrieval recall eval**

Run:

```bash
npm run eval:retrieval
```

Expected:
- `code_duplicate_payment_attempt`: input recall passes and final recall passes.
- `code_webhook_signature_failed`: input recall passes and final recall passes.
- `natural_language_ach_payment`: input recall passes.
- `natural_language_duplicate_payment_meaning`: input recall passes.

If input recall passes but final recall fails, investigate reranker behavior before changing retrieval.

- [ ] **Step 2: Run project gates**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run eval:rag-contract
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit verification-only fixes if needed**

If changes are required during verification:

```bash
git add <specific-files>
git commit -m "fix(retrieval): stabilize hybrid recall checks" -m "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Human Checkpoints

1. After this plan is reviewed: confirm the implementation sequence.
2. After Task 4: inspect baseline retrieval recall. This tells us whether the current failures are retrieval-boundary or reranker-boundary failures.
3. After Task 7: confirm cap, pinning, and RRF behavior before introducing FTS.
4. After Task 10: inspect code and natural-language slices before narrowing the literal lane.
5. After Task 12: compare final eval summary against the baseline.

## Risks and Mitigations

- **Risk:** `websearch_to_tsquery` drops code-shaped tokens or punctuation.
  **Mitigation:** FTS does not own codes. Exact-code extraction and pinned literal lookup own codes.

- **Risk:** Reranker cap drops verbatim code evidence.
  **Mitigation:** Exact-code candidates occupy reserved pinned slots before RRF candidates are appended.

- **Risk:** Direct and hosted retrieval diverge again.
  **Mitigation:** Keep matching function signatures parallel and add tests/smoke checks for searchable fields.

- **Risk:** Parser cleanup changes chunk IDs and breaks eval gold.
  **Mitigation:** Gold expectations match filename/title/content text rather than chunk IDs.

- **Risk:** FTS index migration is not applied in hosted Supabase before the app deploys.
  **Mitigation:** Gate FTS matcher behind the migration and run `npm run db:migrate` before enabling the FTS lane in production.

## Completion Criteria

- `npm run eval:retrieval` reports input and final recall pass for the fixed code slice.
- Natural-language FTS slice has input recall pass without relying on the exact-code lane.
- `npm run eval:rag-contract` remains green.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- No score-blending magic constant is used for candidate selection.
- Exact-code hits are guaranteed into the reranker input up to the configured pinned slot limit.
