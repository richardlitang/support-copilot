import { classifyInvestigationNode } from "@/lib/experimental/graph/nodes/classify-investigation";
import { applyReviewPolicyNode } from "@/lib/experimental/graph/nodes/apply-review-policy";
import { generateClaimsNode } from "@/lib/experimental/graph/nodes/generate-claims";
import { retrieveDocumentationNode } from "@/lib/experimental/graph/nodes/retrieve-documentation";
import { runContextToolsNode } from "@/lib/experimental/graph/nodes/run-context-tools";
import { validateGroundingNode } from "@/lib/experimental/graph/nodes/validate-grounding";
import { createInitialInvestigationGraphState } from "@/lib/experimental/graph/investigation-state";
import type { EvidenceChunk } from "@/lib/types";
import type { AccountRecord, FeatureFlagRecord } from "@/lib/types/investigation";

const evidence: EvidenceChunk[] = [
  {
    id: "chunk-1",
    documentId: "doc-1",
    filename: "exports.md",
    sectionTitle: "Export permissions",
    content: "Exports require billing setup and export permission.",
    score: 0.74,
    rank: 1,
    chunkIndex: 0,
  },
];

const account: AccountRecord = {
  id: "acct-1",
  name: "Acme",
  planTier: "Growth",
  status: "active",
  enabledModules: ["exports"],
  limits: { exportRows: 50000 },
  createdAt: "2026-01-01T00:00:00Z",
};

const flags: FeatureFlagRecord[] = [
  {
    id: "flag-1",
    accountId: "acct-1",
    flagKey: "exports_ui",
    flagValue: true,
    description: "Exports UI enabled",
    rolloutNotes: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("investigation graph nodes", () => {
  it("wraps retrieval and classification without changing their inputs", async () => {
    const initial = createInitialInvestigationGraphState({
      ticket: "How do I enable exports?",
      sessionId: "session-1",
      ragEnabled: true,
    });

    const retrieved = await retrieveDocumentationNode(initial, {
      retrieveEvidence: async (input) => {
        expect(input).toEqual({
          question: "How do I enable exports?",
          sessionId: "session-1",
          limit: 8,
        });
        return evidence;
      },
    });
    const classified = classifyInvestigationNode(retrieved, {
      classifyInvestigation: (input) => {
        expect(input.evidence).toEqual(evidence);
        return {
          mode: "docs_only",
          requiredTools: [],
          routingReason:
            "Strong retrieval and procedural language indicate documentation alone should be sufficient.",
        };
      },
    });

    expect(classified.retrievedEvidence).toEqual(evidence);
    expect(classified.routing?.mode).toBe("docs_only");
    expect(classified.steps).toEqual([
      "initialized",
      "retrieved_documentation",
      "classified_investigation",
    ]);
  });

  it("wraps context tools and conflict detection into graph state", async () => {
    const state = classifyInvestigationNode(
      {
        ...createInitialInvestigationGraphState({
          ticket: "Exports are failing for this account.",
          sessionId: "session-1",
          ragEnabled: true,
          selectedAccountId: "acct-1",
        }),
        retrievedEvidence: evidence,
      },
      {
        classifyInvestigation: () => ({
          mode: "docs_plus_tools",
          requiredTools: ["getAccountContext", "getFeatureFlags"],
          routingReason: "Ticket requires account context.",
        }),
      },
    );

    const withTools = await runContextToolsNode(state, {
      getAccountContext: async () => account,
      getFeatureFlags: async () => flags,
      getRecentErrors: async () => [],
      collectToolArtifacts: async () => ({
        toolEvidence: [
          {
            id: "T1",
            sourceType: "tool",
            toolName: "getAccountContext",
            title: "Acme",
            excerpt: "Plan: Growth. Status: active.",
            raw: account,
          },
        ],
        toolCalls: [
          {
            toolName: "getAccountContext",
            input: { accountId: "acct-1" },
            output: account,
          },
        ],
        account,
        flags,
        errors: [],
        productArea: "exports",
      }),
      detectConflict: (input) => {
        expect(input.docEvidence[0]?.id).toBe("S1");
        return {
          hasConflict: false,
          reason: null,
        };
      },
    });

    expect(withTools.docEvidence[0]?.id).toBe("S1");
    expect(withTools.toolArtifacts.toolEvidence[0]?.id).toBe("T1");
    expect(withTools.hasConflict).toBe(false);
    expect(withTools.steps).toContain("ran_context_tools");
  });

  it("generates claims, validates citations, and applies review policy", async () => {
    const withTools = await runContextToolsNode(
      classifyInvestigationNode(
        {
          ...createInitialInvestigationGraphState({
            ticket: "Exports are failing for this account.",
            sessionId: "session-1",
            ragEnabled: true,
            selectedAccountId: "acct-1",
          }),
          retrievedEvidence: evidence,
        },
        {
          classifyInvestigation: () => ({
            mode: "docs_plus_tools",
            requiredTools: ["getAccountContext"],
            routingReason: "Ticket requires account context.",
          }),
        },
      ),
      {
        getAccountContext: async () => account,
        getFeatureFlags: async () => [],
        getRecentErrors: async () => [],
        collectToolArtifacts: async () => ({
          toolEvidence: [
            {
              id: "T1",
              sourceType: "tool",
              toolName: "getAccountContext",
              title: "Acme",
              excerpt: "Plan: Growth. Status: active.",
              raw: account,
            },
          ],
          toolCalls: [],
          account,
          flags: [],
          errors: [],
          productArea: "exports",
        }),
        detectConflict: () => ({
          hasConflict: false,
          reason: null,
        }),
      },
    );
    const generated = await generateClaimsNode(withTools, {
      generateInvestigationAnswer: async () => ({
        customerReply: {
          claims: [
            { text: "Exports require setup and account verification.", citations: ["S1", "T1"] },
          ],
        },
        internalDiagnosis: {
          claims: [
            { text: "Docs and account context are both available.", citations: ["S1", "T1"] },
          ],
          openQuestions: [],
        },
        insufficientSupport: false,
      }),
    });
    const grounded = validateGroundingNode(generated);
    const reviewed = applyReviewPolicyNode(grounded);

    expect(reviewed.grounding).toEqual({
      validationFailed: false,
      validCitationIds: ["S1", "T1"],
      missingCitationIds: [],
    });
    expect(reviewed.review).toMatchObject({
      supportLevel: "medium",
      reviewStatus: "ready",
      reviewDecision: {
        status: "ready",
        reasonCode: "none",
        action: "none",
      },
      finalMode: "docs_plus_tools",
    });
    expect(reviewed.steps).toEqual([
      "initialized",
      "classified_investigation",
      "ran_context_tools",
      "generated_claims",
      "validated_grounding",
      "applied_review_policy",
    ]);
  });
});
