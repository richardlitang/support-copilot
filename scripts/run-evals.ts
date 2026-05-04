import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasDatabaseConfig } from "../lib/db";
import { createInitialInvestigationGraphState } from "../lib/graph/investigation-state";
import { applyReviewPolicyNode } from "../lib/graph/nodes/apply-review-policy";
import { classifyInvestigationNode } from "../lib/graph/nodes/classify-investigation";
import { generateClaimsNode } from "../lib/graph/nodes/generate-claims";
import { retrieveDocumentationNode } from "../lib/graph/nodes/retrieve-documentation";
import { defaultRunContextToolsAdapters, runContextToolsNode } from "../lib/graph/nodes/run-context-tools";
import { validateGroundingNode } from "../lib/graph/nodes/validate-grounding";
import { investigateTicket } from "../lib/investigate";
import type { EvidenceChunk, StructuredAnswer } from "../lib/types";
import type {
  AccountRecord,
  ErrorEventRecord,
  FeatureFlagRecord,
  ReviewActionKind,
  ReviewReasonCode
} from "../lib/types/investigation";

type EvalCase = {
  id: string;
  bucket: string;
  ticket: string;
  selectedAccountId?: string;
  expectation: string;
  expectedMode?: string;
  expectedReviewStatus?: string;
  expectedReviewReasonCode?: ReviewReasonCode;
  expectedReviewAction?: ReviewActionKind;
  expectedEvidenceKeywords?: string[];
  expectedClaimKeywords?: string[];
  forbiddenClaimKeywords?: string[];
  minDocEvidence?: number;
  requireToolEvidence?: boolean;
};

type EvalSummary = {
  id: string;
  bucket: string;
  mode: string;
  reviewStatus: string;
  reviewReasonCode: string;
  reviewAction: string;
  supportLevel: string;
  insufficientSupport: boolean;
  customerClaims: number;
  internalClaims: number;
  citations: number;
  docEvidence: number;
  toolEvidence: number;
  toolCalls: number;
  selectedAccountId: string | null;
  expectedMode: string | null;
  expectedReviewStatus: string | null;
  expectedReviewReasonCode: string | null;
  expectedReviewAction: string | null;
  expectedEvidenceKeywords: string[];
  missingEvidenceKeywords: string[];
  expectedClaimKeywords: string[];
  missingClaimKeywords: string[];
  forbiddenClaimKeywords: string[];
  presentForbiddenClaimKeywords: string[];
  minDocEvidence: number | null;
  requireToolEvidence: boolean;
  routePassed: boolean;
  reviewPassed: boolean;
  reviewReasonCodePassed: boolean;
  reviewActionPassed: boolean;
  retrievalPassed: boolean;
  claimPassed: boolean;
  forbiddenClaimPassed: boolean;
  toolPassed: boolean;
  graphParityPassed: boolean | null;
  passed: boolean;
  topDocs: Array<{
    id: string;
    filename: string;
    sectionTitle: string | null | undefined;
    score: number;
  }>;
  expectation: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const offlineMode = process.argv.includes("--offline") || process.env.SUPPORT_EVAL_OFFLINE === "true";

const offlineAccounts = new Map<string, AccountRecord>([
  [
    "11111111-1111-4111-8111-111111111111",
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Acme Starter",
      planTier: "Starter",
      status: "active",
      enabledModules: ["imports"],
      limits: { csvImportRows: 10000 },
      createdAt: "2026-04-15T00:00:00.000Z"
    }
  ],
  [
    "22222222-2222-4222-8222-222222222222",
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Northwind Growth",
      planTier: "Growth",
      status: "active",
      enabledModules: ["exports", "imports"],
      limits: { exportRows: 50000 },
      createdAt: "2026-04-15T00:00:00.000Z"
    }
  ],
  [
    "33333333-3333-4333-8333-333333333333",
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Beacon Enterprise",
      planTier: "Enterprise",
      status: "active",
      enabledModules: ["exports", "imports", "audit_logs"],
      limits: {},
      createdAt: "2026-04-15T00:00:00.000Z"
    }
  ],
  [
    "44444444-4444-4444-8444-444444444444",
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Ledger Pro",
      planTier: "Pro",
      status: "billing_hold",
      enabledModules: ["exports"],
      limits: {},
      createdAt: "2026-04-15T00:00:00.000Z"
    }
  ],
  [
    "55555555-5555-4555-8555-555555555555",
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Atlas Import Ops",
      planTier: "Enterprise",
      status: "active",
      enabledModules: ["imports"],
      limits: { csvImportRows: 100000 },
      createdAt: "2026-04-15T00:00:00.000Z"
    }
  ]
]);

const offlineFlags: FeatureFlagRecord[] = [
  {
    id: "flag-111-export",
    accountId: "11111111-1111-4111-8111-111111111111",
    flagKey: "exports_ui_visible",
    flagValue: false,
    description: "Exports are hidden for Starter accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z"
  },
  {
    id: "flag-222-export",
    accountId: "22222222-2222-4222-8222-222222222222",
    flagKey: "exports_ui_visible",
    flagValue: true,
    description: "Exports are visible for Growth accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z"
  },
  {
    id: "flag-333-export",
    accountId: "33333333-3333-4333-8333-333333333333",
    flagKey: "exports_ui_visible",
    flagValue: true,
    description: "Exports are visible for Enterprise accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z"
  }
];

const offlineErrors: ErrorEventRecord[] = [
  {
    id: "err-222-export",
    accountId: "22222222-2222-4222-8222-222222222222",
    productArea: "exports",
    errorCode: "ERR-219",
    summary: "Missing export permission on the actor role.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z"
  },
  {
    id: "err-444-billing",
    accountId: "44444444-4444-4444-8444-444444444444",
    productArea: "billing",
    errorCode: "BILLING-HOLD",
    summary: "Payment failed yesterday and account is in grace-period billing hold.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z"
  },
  {
    id: "err-555-import",
    accountId: "55555555-5555-4555-8555-555555555555",
    productArea: "imports",
    errorCode: "CSV-ROW-LIMIT",
    summary: "Import stalled after row validation near the configured row limit.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z"
  }
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatRuntimeFailure(error: unknown) {
  const message = getErrorMessage(error);

  if (message.startsWith("Eval case ")) {
    return message;
  }

  if (message.includes("fetch failed")) {
    return [
      "Eval environment failure: a Supabase or OpenAI network request failed.",
      "Check that .env.local has valid keys, the Supabase project is reachable, migrations are applied, and demo data is seeded.",
      `Underlying error: ${message}`
    ].join("\n");
  }

  if (message.includes("Missing SUPABASE_URL") || message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return [
      "Eval environment failure: Supabase configuration is missing.",
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local.",
      `Underlying error: ${message}`
    ].join("\n");
  }

  return message;
}

function buildOfflineEvidence(testCase: EvalCase): EvidenceChunk[] {
  if (!testCase.minDocEvidence && !testCase.expectedEvidenceKeywords?.length) {
    return [];
  }

  const keywords = testCase.expectedEvidenceKeywords?.length ? testCase.expectedEvidenceKeywords : ["support"];
  const content = [
    `Offline eval evidence for ${testCase.id}.`,
    ...keywords.map((keyword) => `${keyword} guidance is present in the seeded support documentation.`),
    "Use only cited evidence when generating the reply."
  ].join(" ");

  return [
    {
      id: `${testCase.id}-chunk-1`,
      documentId: `${testCase.id}-doc-1`,
      filename: `${keywords[0] ?? "support"}-offline-evidence.md`,
      sectionTitle: "Offline eval evidence",
      content,
      score: 0.86,
      rank: 1,
      chunkIndex: 0
    }
  ];
}

function createOfflineGroundedAnswer(testCase: EvalCase, evidence: EvidenceChunk[]): StructuredAnswer {
  if (!evidence.length) {
    return {
      answer: "I do not have enough support in the uploaded docs to answer this confidently.",
      claims: [],
      supportLevel: "insufficient_support",
      citations: [],
      insufficientSupport: true
    };
  }

  const expectedClaimText = testCase.expectedClaimKeywords?.length
    ? `The supported answer should mention ${testCase.expectedClaimKeywords.join(", ")}.`
    : "The available support docs contain relevant guidance for this ticket.";

  return {
    answer: `${expectedClaimText} [S1]`,
    claims: [
      {
        text: expectedClaimText,
        citationIds: ["S1"]
      }
    ],
    supportLevel: "medium",
    citations: ["S1"],
    insufficientSupport: false
  };
}

function countClaimCitations(result: Awaited<ReturnType<typeof investigateTicket>>) {
  return new Set([...result.customerReply.claims, ...result.internalDiagnosis.claims].flatMap((claim) => claim.citations)).size;
}

function createOfflineDependencies(testCase: EvalCase) {
  const evidence = buildOfflineEvidence(testCase);

  return {
    persistInvestigationRun: async () => ({
      ticketId: `${testCase.id}-ticket`,
      investigationId: `${testCase.id}-investigation`
    }),
    retrieveEvidence: async () => evidence,
    generateGroundedAnswer: async () => createOfflineGroundedAnswer(testCase, evidence),
    generateInvestigationAnswer: async () => ({
      customerReply: {
        summary: "The investigation found cited support for the customer-facing response.",
        claims: [
          {
            text: testCase.expectedClaimKeywords?.length
              ? `The investigation found cited support for ${testCase.expectedClaimKeywords.join(", ")}.`
              : "The investigation found cited support for the customer-facing response.",
            citations: ["S1" as const, "T1" as const]
          }
        ]
      },
      internalDiagnosis: {
        summary: "Offline tool evidence was combined with retrieved documentation.",
        claims: [
          {
            text: "Offline tool evidence was combined with retrieved documentation.",
            citations: ["S1" as const, "T1" as const]
          }
        ],
        openQuestions: []
      },
      insufficientSupport: false
    }),
    getAccountContext: async (accountId: string) => offlineAccounts.get(accountId) ?? null,
    getFeatureFlags: async (accountId: string) => offlineFlags.filter((flag) => flag.accountId === accountId),
    getRecentErrors: async (input: { accountId: string; productArea?: string | null; limit?: number }) =>
      offlineErrors.filter(
        (error) => error.accountId === input.accountId && (!input.productArea || error.productArea === input.productArea)
      )
  };
}

async function runOfflineGraphParity(input: {
  testCase: EvalCase;
  evalSessionId: string;
  dependencies: ReturnType<typeof createOfflineDependencies>;
}) {
  const initialState = createInitialInvestigationGraphState({
    ticket: input.testCase.ticket,
    sessionId: input.evalSessionId,
    ragEnabled: true,
    selectedAccountId: input.testCase.selectedAccountId ?? null
  });
  const retrieved = await retrieveDocumentationNode(initialState, {
    retrieveEvidence: input.dependencies.retrieveEvidence
  });
  const classified = classifyInvestigationNode(retrieved);
  const withTools = await runContextToolsNode(classified, {
    ...input.dependencies,
    ...defaultRunContextToolsAdapters
  });
  const generated = await generateClaimsNode(withTools, {
    generateGroundedAnswer: input.dependencies.generateGroundedAnswer,
    generateInvestigationAnswer: input.dependencies.generateInvestigationAnswer
  });
  const grounded = validateGroundingNode(generated);
  const reviewed = applyReviewPolicyNode(grounded);

  if (!reviewed.review) {
    throw new Error(`Graph parity run did not produce review state for ${input.testCase.id}.`);
  }

  return {
    mode: reviewed.review.finalMode,
    reviewStatus: reviewed.review.reviewStatus,
    reviewDecision: reviewed.review.reviewDecision
  };
}

async function main() {
  if (!offlineMode && !hasDatabaseConfig()) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. `npm run eval:demo` requires a reachable seeded Supabase project.");
  }

  const evalPath = path.join(__dirname, "..", "demo", "evals.json");
  const cases = JSON.parse(await readFile(evalPath, "utf8")) as EvalCase[];
  const evalSessionId = process.env.EVAL_SESSION_ID ?? "demo-seeded-session";
  const summary: EvalSummary[] = [];
  const failures: string[] = [];

  for (const testCase of cases) {
    const offlineDependencies = offlineMode ? createOfflineDependencies(testCase) : null;
    const result = await investigateTicket(
      {
        ticket: testCase.ticket,
        ragEnabled: true,
        sessionId: evalSessionId,
        selectedAccountId: testCase.selectedAccountId ?? null
      },
      offlineDependencies ?? {}
    ).catch((error: unknown) => {
      throw new Error(`Eval case ${testCase.id} failed before assertions:\n${formatRuntimeFailure(error)}`);
    });
    const graphResult = offlineDependencies
      ? await runOfflineGraphParity({
          testCase,
          evalSessionId,
          dependencies: offlineDependencies
        })
      : null;
    const graphParityPassed = graphResult
      ? graphResult.mode === result.mode &&
        graphResult.reviewStatus === result.reviewStatus &&
        graphResult.reviewDecision.reasonCode === result.reviewDecision.reasonCode &&
        graphResult.reviewDecision.action === result.reviewDecision.action
      : null;
    const expectedEvidenceKeywords = testCase.expectedEvidenceKeywords ?? [];
    const expectedClaimKeywords = testCase.expectedClaimKeywords ?? [];
    const forbiddenClaimKeywords = testCase.forbiddenClaimKeywords ?? [];
    const evidenceHaystack = result.docEvidence
      .map((item) => `${item.filename} ${item.sectionTitle ?? ""} ${item.excerpt}`)
      .join("\n")
      .toLowerCase();
    const claimHaystack = [
      result.customerReply.summary,
      ...result.customerReply.claims.map((claim) => claim.text),
      result.internalDiagnosis.summary,
      ...result.internalDiagnosis.claims.map((claim) => claim.text)
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    const missingEvidenceKeywords = expectedEvidenceKeywords.filter(
      (keyword) => !evidenceHaystack.includes(keyword.toLowerCase())
    );
    const missingClaimKeywords = expectedClaimKeywords.filter((keyword) => !claimHaystack.includes(keyword.toLowerCase()));
    const presentForbiddenClaimKeywords = forbiddenClaimKeywords.filter((keyword) =>
      claimHaystack.includes(keyword.toLowerCase())
    );
    const routePassed = !testCase.expectedMode || result.mode === testCase.expectedMode;
    const reviewPassed = !testCase.expectedReviewStatus || result.reviewStatus === testCase.expectedReviewStatus;
    const reviewReasonCodePassed =
      !testCase.expectedReviewReasonCode || result.reviewDecision.reasonCode === testCase.expectedReviewReasonCode;
    const reviewActionPassed = !testCase.expectedReviewAction || result.reviewDecision.action === testCase.expectedReviewAction;
    const retrievalPassed = (testCase.minDocEvidence ?? 0) <= result.docEvidence.length && missingEvidenceKeywords.length === 0;
    const claimPassed = missingClaimKeywords.length === 0;
    const forbiddenClaimPassed = presentForbiddenClaimKeywords.length === 0;
    const toolPassed = !testCase.requireToolEvidence || result.toolEvidence.length > 0;

    if (!routePassed) {
      failures.push(`${testCase.id}: expected mode ${testCase.expectedMode}, got ${result.mode}`);
    }

    if (!reviewPassed) {
      failures.push(`${testCase.id}: expected reviewStatus ${testCase.expectedReviewStatus}, got ${result.reviewStatus}`);
    }

    if (!reviewReasonCodePassed) {
      failures.push(
        `${testCase.id}: expected review reason code ${testCase.expectedReviewReasonCode}, got ${result.reviewDecision.reasonCode}`
      );
    }

    if (!reviewActionPassed) {
      failures.push(`${testCase.id}: expected review action ${testCase.expectedReviewAction}, got ${result.reviewDecision.action}`);
    }

    if ((testCase.minDocEvidence ?? 0) > result.docEvidence.length) {
      failures.push(`${testCase.id}: expected at least ${testCase.minDocEvidence} doc evidence item(s), got ${result.docEvidence.length}`);
    }

    if (missingEvidenceKeywords.length) {
      failures.push(`${testCase.id}: missing expected evidence keyword(s): ${missingEvidenceKeywords.join(", ")}`);
    }

    if (missingClaimKeywords.length) {
      failures.push(`${testCase.id}: missing expected claim keyword(s): ${missingClaimKeywords.join(", ")}`);
    }

    if (presentForbiddenClaimKeywords.length) {
      failures.push(`${testCase.id}: included forbidden claim keyword(s): ${presentForbiddenClaimKeywords.join(", ")}`);
    }

    if (!toolPassed) {
      failures.push(`${testCase.id}: expected tool evidence, got none`);
    }

    if (graphParityPassed === false && graphResult) {
      failures.push(
        `${testCase.id}: graph parity failed, direct ${result.mode}/${result.reviewStatus}/${result.reviewDecision.reasonCode}/${result.reviewDecision.action}, graph ${graphResult.mode}/${graphResult.reviewStatus}/${graphResult.reviewDecision.reasonCode}/${graphResult.reviewDecision.action}`
      );
    }

    summary.push({
      id: testCase.id,
      bucket: testCase.bucket,
      mode: result.mode,
      reviewStatus: result.reviewStatus,
      reviewReasonCode: result.reviewDecision.reasonCode,
      reviewAction: result.reviewDecision.action,
      supportLevel: result.supportLevel,
      insufficientSupport: result.supportLevel === "insufficient_support",
      customerClaims: result.customerReply.claims.length,
      internalClaims: result.internalDiagnosis.claims.length,
      citations: countClaimCitations(result),
      docEvidence: result.docEvidence.length,
      toolEvidence: result.toolEvidence.length,
      toolCalls: result.toolCalls.length,
      selectedAccountId: testCase.selectedAccountId ?? null,
      expectedMode: testCase.expectedMode ?? null,
      expectedReviewStatus: testCase.expectedReviewStatus ?? null,
      expectedReviewReasonCode: testCase.expectedReviewReasonCode ?? null,
      expectedReviewAction: testCase.expectedReviewAction ?? null,
      expectedEvidenceKeywords,
      missingEvidenceKeywords,
      expectedClaimKeywords,
      missingClaimKeywords,
      forbiddenClaimKeywords,
      presentForbiddenClaimKeywords,
      minDocEvidence: testCase.minDocEvidence ?? null,
      requireToolEvidence: testCase.requireToolEvidence ?? false,
      routePassed,
      reviewPassed,
      reviewReasonCodePassed,
      reviewActionPassed,
      retrievalPassed,
      claimPassed,
      forbiddenClaimPassed,
      toolPassed,
      graphParityPassed,
      passed:
        routePassed &&
        reviewPassed &&
        reviewReasonCodePassed &&
        reviewActionPassed &&
        retrievalPassed &&
        claimPassed &&
        forbiddenClaimPassed &&
        toolPassed &&
        graphParityPassed !== false,
      topDocs: result.docEvidence.slice(0, 3).map((item) => ({
        id: item.id,
        filename: item.filename,
        sectionTitle: item.sectionTitle,
        score: Number(item.score.toFixed(4))
      })),
      expectation: testCase.expectation
    });
  }

  const passedCount = summary.filter((item) => item.passed).length;
  const routePassed = summary.filter((item) => item.routePassed).length;
  const reviewPassed = summary.filter((item) => item.reviewPassed).length;
  const reviewReasonCodePassed = summary.filter((item) => item.reviewReasonCodePassed).length;
  const reviewActionPassed = summary.filter((item) => item.reviewActionPassed).length;
  const retrievalPassed = summary.filter((item) => item.retrievalPassed).length;
  const claimPassed = summary.filter((item) => item.claimPassed).length;
  const forbiddenClaimPassed = summary.filter((item) => item.forbiddenClaimPassed).length;
  const toolPassed = summary.filter((item) => item.toolPassed).length;
  const graphParityItems = summary.filter((item) => item.graphParityPassed !== null);
  const graphParityPassed = graphParityItems.filter((item) => item.graphParityPassed).length;

  console.log("Support Copilot eval summary");
  console.log(`Mode: ${offlineMode ? "offline mock" : "live Supabase/OpenAI"}`);
  console.log(`Cases: ${passedCount}/${summary.length} passed`);
  console.log(`Routing: ${routePassed}/${summary.length} passed`);
  console.log(`Review: ${reviewPassed}/${summary.length} passed`);
  console.log(`Review reason codes: ${reviewReasonCodePassed}/${summary.length} passed`);
  console.log(`Review actions: ${reviewActionPassed}/${summary.length} passed`);
  console.log(`Retrieval: ${retrievalPassed}/${summary.length} passed`);
  console.log(`Claim content: ${claimPassed}/${summary.length} passed`);
  console.log(`Forbidden claims: ${forbiddenClaimPassed}/${summary.length} passed`);
  console.log(`Tool evidence: ${toolPassed}/${summary.length} passed`);
  if (graphParityItems.length) {
    console.log(`Graph parity: ${graphParityPassed}/${graphParityItems.length} passed`);
  }

  console.log("\nCase results:");
  for (const item of summary) {
    const status = item.passed ? "PASS" : "FAIL";
    const topDocList = item.topDocs.length
      ? item.topDocs.map((doc) => `${doc.id}:${doc.filename}${doc.sectionTitle ? `#${doc.sectionTitle}` : ""}@${doc.score}`).join(", ")
      : "none";
    console.log(
      `- ${status} ${item.id} [${item.bucket}] mode=${item.mode} review=${item.reviewStatus} reason=${item.reviewReasonCode} action=${item.reviewAction} docs=${item.docEvidence} tools=${item.toolEvidence} top=${topDocList}`
    );
    if (item.missingEvidenceKeywords.length) {
      console.log(`  missing evidence keywords: ${item.missingEvidenceKeywords.join(", ")}`);
    }
    if (item.missingClaimKeywords.length) {
      console.log(`  missing claim keywords: ${item.missingClaimKeywords.join(", ")}`);
    }
    if (item.presentForbiddenClaimKeywords.length) {
      console.log(`  forbidden claim keywords present: ${item.presentForbiddenClaimKeywords.join(", ")}`);
    }
    if (!item.reviewReasonCodePassed) {
      console.log(`  expected review reason code: ${item.expectedReviewReasonCode ?? "none"}`);
    }
    if (!item.reviewActionPassed) {
      console.log(`  expected review action: ${item.expectedReviewAction ?? "none"}`);
    }
  }

  if (failures.length) {
    console.error("\nEval failures:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} evals passed.`);
}

main().catch((error) => {
  console.error(formatRuntimeFailure(error));
  process.exit(1);
});
