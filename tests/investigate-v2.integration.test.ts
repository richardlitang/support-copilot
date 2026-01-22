import { investigateTicket } from "@/lib/investigate";

describe("investigateTicket v2", () => {
  const baseEvidence = [
    {
      id: "chunk-1",
      documentId: "doc-1",
      filename: "feature-permissions.md",
      sectionTitle: "Exports",
      content: "Exports are available on Growth and Enterprise plans.",
      score: 0.84,
      rank: 1,
      chunkIndex: 0
    }
  ];

  const baseDeps = {
    createTicket: async () => "ticket-v2",
    createInvestigation: async () => "investigation-v2",
    insertInvestigationSources: async () => undefined,
    insertInvestigationToolCalls: async () => undefined
  };

  it("returns docs plus tools when account context is selected", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why can't this customer access exports?",
        ragEnabled: true,
        sessionId: "session-1",
        selectedAccountId: "acct-1"
      },
      {
        ...baseDeps,
        retrieveEvidence: async () => baseEvidence,
        generateGroundedAnswer: async () => {
          throw new Error("docs-only generator should not run for docs+tools cases");
        },
        generateInvestigationAnswerV2: async () => ({
          customerReply: {
            summary: "Exports are not enabled for this account.",
            claims: [
              {
                text: "Exports are not enabled for this account.",
                citations: ["S1", "T1", "T2"]
              }
            ]
          },
          internalDiagnosis: {
            summary: "Starter account with exports disabled.",
            claims: [
              {
                text: "The docs gate exports by plan, and the account does not meet the requirement.",
                citations: ["S1", "T1", "T2"]
              }
            ],
            openQuestions: []
          },
          insufficientSupport: false
        }),
        getAccountContext: async () => ({
          id: "acct-1",
          name: "Acme Starter",
          planTier: "Starter",
          status: "active",
          enabledModules: ["imports"],
          limits: { csvImportRows: 10000 },
          createdAt: "2026-04-15T00:00:00.000Z"
        }),
        getFeatureFlags: async () => [
          {
            id: "flag-1",
            accountId: "acct-1",
            flagKey: "exports_ui_visible",
            flagValue: false,
            description: "Controls export visibility",
            rolloutNotes: null,
            createdAt: "2026-04-15T00:00:00.000Z"
          }
        ],
        getRecentErrors: async () => []
      }
    );

    expect(result.mode).toBe("docs_plus_tools");
    expect(result.toolEvidence.length).toBeGreaterThan(0);
    expect(result.reviewStatus).toBe("ready");
  });

  it("returns docs plus tools when user-provided investigation context is present without a seeded account", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why can't this customer access exports on our account?",
        ragEnabled: true,
        sessionId: "session-1",
        selectedAccountId: null,
        investigationContext: "Plan: Starter. Exports UI hidden. Billing setup complete."
      },
      {
        ...baseDeps,
        retrieveEvidence: async () => baseEvidence,
        generateGroundedAnswer: async () => {
          throw new Error("docs-only generator should not run for docs+tools cases");
        },
        generateInvestigationAnswerV2: async () => ({
          customerReply: {
            summary: "Exports are not available for the described account state.",
            claims: [
              {
                text: "The provided context indicates a Starter plan where exports remain unavailable.",
                citations: ["S1", "T1"]
              }
            ]
          },
          internalDiagnosis: {
            summary: "Provided context points to a plan gate.",
            claims: [
              {
                text: "The docs gate exports by plan, and the provided context says the account is Starter.",
                citations: ["S1", "T1"]
              }
            ],
            openQuestions: []
          },
          insufficientSupport: false
        }),
        getAccountContext: async () => null,
        getFeatureFlags: async () => [],
        getRecentErrors: async () => []
      }
    );

    expect(result.mode).toBe("docs_plus_tools");
    expect(result.toolEvidence[0]?.toolName).toBe("getProvidedContext");
  });

  it("returns immediate human review when structured context is required but missing", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why can't this customer access exports on our account?",
        ragEnabled: true,
        sessionId: "session-1",
        selectedAccountId: null
      },
      {
        ...baseDeps,
        retrieveEvidence: async () => baseEvidence,
        generateGroundedAnswer: async () => {
          throw new Error("docs-only generator should not run when account context is missing");
        },
        generateInvestigationAnswerV2: async () => {
          throw new Error("v2 generator should not run when account context is missing");
        },
        getAccountContext: async () => null,
        getFeatureFlags: async () => [],
        getRecentErrors: async () => []
      }
    );

    expect(result.mode).toBe("needs_human_review");
    expect(result.reviewStatus).toBe("needs_human_review");
    expect(result.routingReason).toContain("none was provided");
    expect(result.toolEvidence.length).toBeGreaterThan(0);
  });

  it("escalates unresolved docs plus tools runs to human review when tool state does not explain the issue", async () => {
    const result = await investigateTicket(
      {
        ticket: "This Enterprise workspace says exports are enabled, but the issue still persists.",
        ragEnabled: true,
        sessionId: "session-1",
        selectedAccountId: "acct-enterprise"
      },
      {
        ...baseDeps,
        retrieveEvidence: async () => baseEvidence,
        generateGroundedAnswer: async () => {
          throw new Error("docs-only generator should not run for docs+tools cases");
        },
        generateInvestigationAnswerV2: async () => {
          throw new Error("v2 generator should not run once conflict is detected");
        },
        getAccountContext: async () => ({
          id: "acct-enterprise",
          name: "Beacon Enterprise",
          planTier: "Enterprise",
          status: "active",
          enabledModules: ["exports", "imports", "audit_logs"],
          limits: {},
          createdAt: "2026-04-15T00:00:00.000Z"
        }),
        getFeatureFlags: async () => [
          {
            id: "flag-enterprise",
            accountId: "acct-enterprise",
            flagKey: "exports_ui_visible",
            flagValue: true,
            description: "Controls export visibility",
            rolloutNotes: null,
            createdAt: "2026-04-15T00:00:00.000Z"
          }
        ],
        getRecentErrors: async () => []
      }
    );

    expect(result.mode).toBe("needs_human_review");
    expect(result.reviewStatus).toBe("needs_human_review");
    expect(result.internalDiagnosis.openQuestions.length).toBeGreaterThan(0);
  });
});
