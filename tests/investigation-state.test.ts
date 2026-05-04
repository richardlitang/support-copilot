import {
  createInitialInvestigationGraphState,
  markInvestigationGraphStep
} from "@/lib/graph/investigation-state";
import type { InvestigationGraphState } from "@/lib/graph/investigation-state";

describe("investigation graph state", () => {
  it("creates an inspectable empty graph state from request input", () => {
    const state = createInitialInvestigationGraphState({
      ticket: "Exports are failing for this account.",
      sessionId: "session-1",
      ragEnabled: true,
      selectedAccountId: "acct-1",
      investigationContext: "User reports ERR-219."
    });

    expect(state).toMatchObject({
      input: {
        ticket: "Exports are failing for this account.",
        sessionId: "session-1",
        ragEnabled: true,
        selectedAccountId: "acct-1",
        investigationContext: "User reports ERR-219."
      },
      steps: ["initialized"],
      retrievedEvidence: [],
      routing: null,
      docEvidence: [],
      toolArtifacts: {
        toolEvidence: [],
        toolCalls: [],
        account: null,
        flags: [],
        errors: [],
        productArea: null
      },
      claimDraft: null,
      grounding: null,
      review: null,
      persistence: {},
      missingRequiredContext: false,
      hasConflict: false,
      conflictReason: null
    });
  });

  it("records graph progress once per step", () => {
    const state = createInitialInvestigationGraphState({
      ticket: "How do I enable exports?",
      sessionId: "session-1",
      ragEnabled: true
    });

    const retrieved = markInvestigationGraphStep(state, "retrieved_documentation");
    const duplicate = markInvestigationGraphStep(retrieved, "retrieved_documentation");
    const classified = markInvestigationGraphStep(duplicate, "classified_investigation");

    expect(classified.steps).toEqual(["initialized", "retrieved_documentation", "classified_investigation"]);
  });

  it("keeps future graph node outputs in one typed state contract", () => {
    const state: InvestigationGraphState = {
      ...createInitialInvestigationGraphState({
        ticket: "CSV import is stuck.",
        sessionId: "session-1",
        ragEnabled: true
      }),
      routing: {
        mode: "docs_plus_tools",
        requiredTools: ["getAccountContext", "getRecentErrors"],
        routingReason: "Ticket includes failure language and account-specific state."
      },
      docEvidence: [
        {
          id: "S1",
          sourceType: "doc",
          documentId: "doc-1",
          filename: "imports.md",
          sectionTitle: "CSV import troubleshooting",
          excerpt: "CSV imports can stall when required headers are missing.",
          score: 0.74,
          chunkIndex: 0
        }
      ],
      toolArtifacts: {
        toolEvidence: [
          {
            id: "T1",
            sourceType: "tool",
            toolName: "getRecentErrors",
            title: "Recent errors",
            excerpt: "ERR-CSV-42: Missing required CSV header.",
            raw: []
          }
        ],
        toolCalls: [
          {
            toolName: "getRecentErrors",
            input: { accountId: "acct-1", productArea: "imports" },
            output: []
          }
        ],
        account: null,
        flags: [],
        errors: [],
        productArea: "imports"
      },
      claimDraft: {
        customerReply: {
          claims: [{ text: "The import may be blocked by missing CSV headers.", citations: ["S1"] }]
        },
        internalDiagnosis: {
          claims: [{ text: "Recent tool state shows ERR-CSV-42 for the account.", citations: ["T1"] }],
          openQuestions: []
        },
        insufficientSupport: false
      },
      grounding: {
        validationFailed: false,
        validCitationIds: ["S1", "T1"],
        missingCitationIds: []
      },
      review: {
        supportLevel: "medium",
        reviewStatus: "ready",
        reviewDecision: {
          status: "ready",
          reasonCode: "none",
          action: "none"
        },
        finalMode: "docs_plus_tools",
        routingReason: "Ticket includes failure language and account-specific state."
      },
      persistence: {
        ticketId: "ticket-1",
        investigationId: "investigation-1"
      }
    };

    expect(state.review?.reviewStatus).toBe("ready");
    expect(state.claimDraft?.internalDiagnosis.claims[0]?.citations).toEqual(["T1"]);
    expect(state.persistence.investigationId).toBe("investigation-1");
  });
});
