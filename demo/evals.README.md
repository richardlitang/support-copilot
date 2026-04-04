# Support Copilot Demo Evals

`demo/evals.json` is the canonical lightweight eval suite for the portfolio demo path.

Each case should test behavior that matters for a support investigation workflow:

- `expectedMode`: expected route, such as `docs_only`, `docs_plus_tools`, or `needs_human_review`.
- `expectedReviewStatus`: expected final review status.
- `minDocEvidence`: minimum retrieved source count.
- `requireToolEvidence`: whether tool/context evidence must be present.
- `expectedEvidenceKeywords`: broad keywords that must appear in retrieved document evidence.

The keyword checks are intentionally simple. They are not semantic grading; they catch obvious retrieval regressions before adding more orchestration.

Run:

```bash
npm run eval:demo
```

When Supabase/OpenAI are unavailable, run the offline harness:

```bash
npm run eval:demo:offline
```

The offline harness uses mocked evidence and tool outputs. It is useful for checking routing, report formatting, and fallback wiring, but it does not prove live retrieval quality.

The runner prints route, review, retrieval, and tool-evidence pass counts plus top retrieved docs for each case.
