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
Our production checkout suddenly started failing with livemode_mismatch. It works fine in test mode. We deployed yesterday but I’m not sure what changed. Can you help?
```

Expected behavior:

- Mode is `docs_only`.
- Customer reply cites documentation evidence.
- Internal diagnosis stays concise.
- Evidence rail shows the retrieved PayBridge error-code source chunk.

Talk track:

"This is the clean docs-only path. The answer is short because every claim needs a citation. The evidence rail makes retrieval visible without opening a separate debug panel."

## Path 2: Literal Retrieval

Ticket:

```text
Webhook verification started failing after we rotated our webhook secret. We’re using Express and bodyParser.json() before verifying the signature. Error is webhook_signature_failed.
```

Expected behavior:

- Mode is `docs_only`.
- Evidence includes the exact webhook signature failure entry.
- The evidence rail shows whether the chunk came from literal or hybrid retrieval.
- Customer reply stays implementation-focused and cites the source.

Talk track:

"This shows why the retrieval stack is more than vector search. Support tickets contain exact codes, so the app expands the candidate set with literal matches before reranking."

## Path 3: Duplicate Payment Guardrail

Ticket:

```text
Some customers are double-clicking the Pay button and we’re getting idempotency_key_in_use. We use the same idempotency key for all checkout attempts from the same cart.
```

Expected behavior:

- Mode is `docs_only`.
- Reply explains idempotency key reuse only for true retries of the exact same request body.
- Evidence cites the idempotency section.

Talk track:

"This is a practical support answer, not just a source lookup. The system turns the code entry into a safe customer-facing next step."

## Path 4: Weak Evidence

Ticket:

```text
Payments are broken. Please tell us the root cause ASAP.
```

Expected behavior:

- The system asks for missing identifiers instead of naming a root cause.
- If evidence is too weak, the docs-gap report gives a reusable artifact for the docs owner.

Talk track:

"This is the negative control. A convincing RAG demo needs to show what happens when the ticket lacks enough evidence, and this one turns weak support into a useful next step."

## Closing

"The current implementation is a deterministic, inspectable support workflow. It answers when evidence supports it, improves recall with literal-aware candidate expansion and reranking, and produces a docs-gap report when it cannot safely answer."
