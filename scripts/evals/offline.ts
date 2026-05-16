import { createInitialInvestigationGraphState } from "../../lib/experimental/graph/investigation-state";
import { applyReviewPolicyNode } from "../../lib/experimental/graph/nodes/apply-review-policy";
import { classifyInvestigationNode } from "../../lib/experimental/graph/nodes/classify-investigation";
import { generateClaimsNode } from "../../lib/experimental/graph/nodes/generate-claims";
import { retrieveDocumentationNode } from "../../lib/experimental/graph/nodes/retrieve-documentation";
import {
  defaultRunContextToolsAdapters,
  runContextToolsNode,
} from "../../lib/experimental/graph/nodes/run-context-tools";
import { validateGroundingNode } from "../../lib/experimental/graph/nodes/validate-grounding";
import type { EvidenceChunk, StructuredAnswer } from "../../lib/types";
import type {
  AccountRecord,
  ErrorEventRecord,
  FeatureFlagRecord,
} from "../../lib/types/investigation";
import type { EvalCase } from "./types";

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
      createdAt: "2026-04-15T00:00:00.000Z",
    },
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
      createdAt: "2026-04-15T00:00:00.000Z",
    },
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
      createdAt: "2026-04-15T00:00:00.000Z",
    },
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
      createdAt: "2026-04-15T00:00:00.000Z",
    },
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
      createdAt: "2026-04-15T00:00:00.000Z",
    },
  ],
]);

const offlineFlags: FeatureFlagRecord[] = [
  {
    id: "flag-111-export",
    accountId: "11111111-1111-4111-8111-111111111111",
    flagKey: "exports_ui_visible",
    flagValue: false,
    description: "Exports are hidden for Starter accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z",
  },
  {
    id: "flag-222-export",
    accountId: "22222222-2222-4222-8222-222222222222",
    flagKey: "exports_ui_visible",
    flagValue: true,
    description: "Exports are visible for Growth accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z",
  },
  {
    id: "flag-333-export",
    accountId: "33333333-3333-4333-8333-333333333333",
    flagKey: "exports_ui_visible",
    flagValue: true,
    description: "Exports are visible for Enterprise accounts.",
    rolloutNotes: null,
    createdAt: "2026-04-15T00:00:00.000Z",
  },
];

const offlineErrors: ErrorEventRecord[] = [
  {
    id: "err-222-export",
    accountId: "22222222-2222-4222-8222-222222222222",
    productArea: "exports",
    errorCode: "ERR-219",
    summary: "Missing export permission on the actor role.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z",
  },
  {
    id: "err-444-billing",
    accountId: "44444444-4444-4444-8444-444444444444",
    productArea: "billing",
    errorCode: "BILLING-HOLD",
    summary: "Payment failed yesterday and account is in grace-period billing hold.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z",
  },
  {
    id: "err-555-import",
    accountId: "55555555-5555-4555-8555-555555555555",
    productArea: "imports",
    errorCode: "CSV-ROW-LIMIT",
    summary: "Import stalled after row validation near the configured row limit.",
    occurredAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z",
  },
];

function buildOfflineEvidence(testCase: EvalCase): EvidenceChunk[] {
  if (!testCase.minDocEvidence && !testCase.expectedEvidenceKeywords?.length) {
    return [];
  }

  const keywords = testCase.expectedEvidenceKeywords?.length
    ? testCase.expectedEvidenceKeywords
    : ["support"];
  const content = [
    `Offline eval evidence for ${testCase.id}.`,
    ...keywords.map(
      (keyword) => `${keyword} guidance is present in the seeded support documentation.`,
    ),
    "Use only cited evidence when generating the reply.",
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
      chunkIndex: 0,
    },
  ];
}

function createOfflineGroundedAnswer(
  testCase: EvalCase,
  evidence: EvidenceChunk[],
): StructuredAnswer {
  if (!evidence.length) {
    return {
      answer: "I do not have enough support in the uploaded docs to answer this confidently.",
      claims: [],
      supportLevel: "insufficient_support",
      citations: [],
      insufficientSupport: true,
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
        citationIds: ["S1"],
      },
    ],
    supportLevel: "medium",
    citations: ["S1"],
    insufficientSupport: false,
  };
}

export function createOfflineDependencies(testCase: EvalCase) {
  const evidence = buildOfflineEvidence(testCase);

  return {
    persistInvestigationRun: async () => ({
      ticketId: `${testCase.id}-ticket`,
      investigationId: `${testCase.id}-investigation`,
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
            citations: ["S1" as const, "T1" as const],
          },
        ],
      },
      internalDiagnosis: {
        summary: "Offline tool evidence was combined with retrieved documentation.",
        claims: [
          {
            text: "Offline tool evidence was combined with retrieved documentation.",
            citations: ["S1" as const, "T1" as const],
          },
        ],
        openQuestions: [],
      },
      insufficientSupport: false,
    }),
    getAccountContext: async (accountId: string) => offlineAccounts.get(accountId) ?? null,
    getFeatureFlags: async (accountId: string) =>
      offlineFlags.filter((flag) => flag.accountId === accountId),
    getRecentErrors: async (input: {
      accountId: string;
      productArea?: string | null;
      limit?: number;
    }) =>
      offlineErrors.filter(
        (error) =>
          error.accountId === input.accountId &&
          (!input.productArea || error.productArea === input.productArea),
      ),
  };
}

export async function runOfflineGraphParity(input: {
  testCase: EvalCase;
  evalSessionId: string;
  dependencies: ReturnType<typeof createOfflineDependencies>;
}) {
  const initialState = createInitialInvestigationGraphState({
    ticket: input.testCase.ticket,
    sessionId: input.evalSessionId,
    ragEnabled: true,
    selectedAccountId: input.testCase.selectedAccountId ?? null,
  });
  const retrieved = await retrieveDocumentationNode(initialState, {
    retrieveEvidence: input.dependencies.retrieveEvidence,
  });
  const classified = classifyInvestigationNode(retrieved);
  const withTools = await runContextToolsNode(classified, {
    ...input.dependencies,
    ...defaultRunContextToolsAdapters,
  });
  const generated = await generateClaimsNode(withTools, {
    generateGroundedAnswer: input.dependencies.generateGroundedAnswer,
    generateInvestigationAnswer: input.dependencies.generateInvestigationAnswer,
  });
  const grounded = validateGroundingNode(generated);
  const reviewed = applyReviewPolicyNode(grounded);

  if (!reviewed.review) {
    throw new Error(`Graph parity run did not produce review state for ${input.testCase.id}.`);
  }

  return {
    mode: reviewed.review.finalMode,
    reviewStatus: reviewed.review.reviewStatus,
    reviewDecision: reviewed.review.reviewDecision,
  };
}
