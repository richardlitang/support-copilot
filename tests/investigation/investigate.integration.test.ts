import { investigateTicket } from "@/src/server/investigation/investigate";

describe("investigateTicket", () => {
  it("returns a grounded investigation with citations when evidence is strong", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why do exports fail after setup?",
        ragEnabled: true,
        sessionId: "test-session",
      },
      {
        persistInvestigationRun: async () => ({
          ticketId: "ticket-1",
          investigationId: "investigation-1",
        }),
        retrieveEvidence: async () => [
          {
            id: "chunk-1",
            documentId: "doc-1",
            filename: "exports.md",
            sectionTitle: "Common export failures",
            content: "Check billing setup and write permissions.",
            score: 0.9,
            rank: 1,
            chunkIndex: 0,
          },
          {
            id: "chunk-2",
            documentId: "doc-2",
            filename: "billing.md",
            sectionTitle: "Required billing state",
            content: "Jobs stay blocked until billing setup is complete.",
            score: 0.81,
            rank: 2,
            chunkIndex: 1,
          },
        ],
        generateGroundedAnswer: async () => ({
          answer: "Check billing setup first [S1][S2].\n\nConfirm the actor has write access [S1].",
          claims: [
            {
              text: "Check billing setup first.",
              citationIds: ["S1", "S2"],
            },
            {
              text: "Confirm the actor has write access.",
              citationIds: ["S1"],
            },
          ],
          supportLevel: "medium",
          citations: ["S1", "S2"],
          insufficientSupport: false,
        }),
      },
    );

    expect(result.supportLevel).toBe("high");
    expect(result.customerReply.claims.map((claim) => claim.citations)).toEqual([
      ["S1", "S2"],
      ["S1"],
    ]);
    expect(result.customerReply.claims).toHaveLength(2);
  });

  it("falls back when evidence is weak or RAG is disabled", async () => {
    const result = await investigateTicket(
      {
        ticket: "How do I rotate encryption keys?",
        ragEnabled: false,
        sessionId: "test-session",
      },
      {
        persistInvestigationRun: async () => ({
          ticketId: "ticket-2",
          investigationId: "investigation-2",
        }),
        retrieveEvidence: async () => [],
        generateGroundedAnswer: async () => {
          throw new Error("This should not be called when RAG is disabled.");
        },
      },
    );

    expect(result.supportLevel).toBe("insufficient_support");
    expect(result.customerReply.claims).toEqual([]);
  });

  it("returns evidence-only results without calling the answer model", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why do exports fail after setup?",
        executionMode: "evidence_only",
        ragEnabled: true,
        sessionId: "test-session",
      },
      {
        persistInvestigationRun: async () => ({
          ticketId: "ticket-evidence",
          investigationId: "investigation-evidence",
        }),
        retrieveEvidence: async () => [
          {
            id: "chunk-1",
            documentId: "doc-1",
            filename: "exports.md",
            sectionTitle: "Common export failures",
            content: "Check billing setup and write permissions.",
            score: 0.9,
            rank: 1,
            chunkIndex: 0,
          },
        ],
        generateGroundedAnswer: async () => {
          throw new Error("Evidence-only mode should not call the answer model.");
        },
        generateInvestigationAnswer: async () => {
          throw new Error("Evidence-only mode should not call the structured answer model.");
        },
      },
    );

    expect(result.executionMode).toBe("evidence_only");
    expect(result.docEvidence).toHaveLength(1);
    expect(result.customerReply.claims).toEqual([]);
    expect(result.pipelineTrace.find((step) => step.id === "draft")).toMatchObject({
      status: "skipped",
    });
  });
});
