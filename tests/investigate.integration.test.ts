import { investigateTicket } from "@/lib/investigate";

describe("investigateTicket", () => {
  it("returns a grounded investigation with citations when evidence is strong", async () => {
    const result = await investigateTicket(
      {
        ticket: "Why do exports fail after setup?",
        ragEnabled: true,
        sessionId: "test-session"
      },
      {
        createTicket: async () => "ticket-1",
        createInvestigation: async () => "investigation-1",
        insertInvestigationSources: async () => undefined,
        retrieveEvidence: async () => [
          {
            id: "chunk-1",
            documentId: "doc-1",
            filename: "exports.md",
            sectionTitle: "Common export failures",
            content: "Check billing setup and write permissions.",
            score: 0.9,
            rank: 1,
            chunkIndex: 0
          },
          {
            id: "chunk-2",
            documentId: "doc-2",
            filename: "billing.md",
            sectionTitle: "Required billing state",
            content: "Jobs stay blocked until billing setup is complete.",
            score: 0.81,
            rank: 2,
            chunkIndex: 1
          }
        ],
        generateGroundedAnswer: async () => ({
          answer: "Check billing setup first [S1][S2].\n\nConfirm the actor has write access [S1].",
          claims: [
            {
              text: "Check billing setup first.",
              citationIds: ["S1", "S2"]
            },
            {
              text: "Confirm the actor has write access.",
              citationIds: ["S1"]
            }
          ],
          supportLevel: "medium",
          citations: ["S1", "S2"],
          insufficientSupport: false
        })
      }
    );

    expect(result.supportLevel).toBe("high");
    expect(result.citations).toEqual(["S1", "S2"]);
    expect(result.insufficientSupport).toBe(false);
    expect(result.claims).toHaveLength(2);
  });

  it("falls back when evidence is weak or RAG is disabled", async () => {
    const result = await investigateTicket(
      {
        ticket: "How do I rotate encryption keys?",
        ragEnabled: false,
        sessionId: "test-session"
      },
      {
        createTicket: async () => "ticket-2",
        createInvestigation: async () => "investigation-2",
        insertInvestigationSources: async () => undefined,
        retrieveEvidence: async () => [],
        generateGroundedAnswer: async () => {
          throw new Error("This should not be called when RAG is disabled.");
        }
      }
    );

    expect(result.supportLevel).toBe("insufficient_support");
    expect(result.insufficientSupport).toBe(true);
    expect(result.citations).toEqual([]);
    expect(result.claims).toEqual([]);
  });
});
