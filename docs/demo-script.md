# Support Copilot Demo Script

Target length: 3 minutes.

## Opening

"Support Copilot is a support investigation workbench. It is not a generic chat-with-files demo. The point is to show exactly what documentation was retrieved, what evidence supports each claim, and when the system refuses to answer because support is weak."

## Setup

Before the demo:

```bash
npm run seed:demo
npm run eval:demo
npm run dev
```

If the eval command fails, do not demo until Supabase, migrations, and seeded docs are fixed.

## Path 1: Docs-Only Grounded Answer

Ticket:

```text
What permissions are required to install the CRM integration?
```

Expected behavior:

- Mode is `docs_only`.
- Customer reply cites documentation evidence.
- Internal diagnosis stays concise.
- Evidence rail shows the retrieved integration/admin source chunk.

Talk track:

"This is the clean docs-only path. The answer is short because every claim needs a citation. The evidence rail makes retrieval visible without opening a separate debug panel."

## Path 2: Docs Plus Structured Context

Ticket:

```text
Why can't this customer access exports?
```

Use a seeded Starter account if the account selector/context UI is enabled.

Expected behavior:

- Mode is `docs_plus_tools`.
- Output combines plan/export docs with structured context.
- Tool evidence appears separately from document evidence.
- Customer reply is safe; internal diagnosis can be more explicit.

Talk track:

"This is what makes the project more than RAG. Documentation says what should happen generally, while structured context explains this customer's actual state. The UI keeps those sources separate."

## Path 3: Missing Context Human Review

Ticket:

```text
Why is our workspace missing exports even though the customer says they should have them?
```

Do not provide account/context information.

Expected behavior:

- Mode is `needs_human_review`.
- Review status is `needs_human_review`.
- Customer-facing output is cautious.
- Internal diagnosis says account or structured context is required.

Talk track:

"The system does not hard-block the user, but it also does not pretend docs alone can answer an account-specific question. This is the trust boundary."

## Path 4: Unsupported Question

Ticket:

```text
How do I rotate the product's encryption keys?
```

Expected behavior:

- The system falls back to insufficient support or human review.
- It does not invent setup steps.

Talk track:

"This is the negative control. A convincing RAG demo needs to show what happens when the corpus does not support the question."

## Closing

"The current implementation is a deterministic, inspectable support workflow. The next step is not adding vague agents; it is moving this direct pipeline into a LangGraph-style state machine with the same eval suite proving parity."
