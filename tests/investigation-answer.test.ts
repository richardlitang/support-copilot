import { validateInvestigationAnswer } from "@/lib/answer";

describe("validateInvestigationAnswer", () => {
  const docEvidence = [
    {
      id: "S1" as const,
      sourceType: "doc" as const,
      documentId: "doc-1",
      filename: "feature-permissions.md",
      sectionTitle: "Exports",
      excerpt: "Exports are available on Growth and Enterprise plans.",
      score: 0.82,
      chunkIndex: 0
    }
  ];

  const toolEvidence = [
    {
      id: "T1" as const,
      sourceType: "tool" as const,
      toolName: "getAccountContext" as const,
      title: "Acme Starter",
      excerpt: "Plan: Starter. Status: active. Enabled modules: imports.",
      raw: {
        planTier: "Starter"
      }
    }
  ];

  it("accepts mixed doc and tool citations", () => {
    const result = validateInvestigationAnswer({
      answer: {
        customerReplyClaims: [
          {
            text: "Exports are not available on this Starter account.",
            citations: ["S1", "T1"]
          }
        ],
        internalDiagnosisClaims: [
          {
            text: "The docs restrict exports to Growth and Enterprise, and the selected account is Starter.",
            citations: ["S1", "T1"]
          }
        ],
        openQuestions: [],
        insufficientSupport: false
      },
      docEvidence,
      toolEvidence
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error("Expected mixed evidence answer to validate.");
    }
    expect(result.answer.customerReply.claims[0]?.citations).toEqual(["S1", "T1"]);
  });

  it("rejects claims with unknown citations", () => {
    const result = validateInvestigationAnswer({
      answer: {
        customerReplyClaims: [
          {
            text: "Exports are blocked for this account.",
            citations: ["T9"]
          }
        ],
        internalDiagnosisClaims: [],
        openQuestions: [],
        insufficientSupport: false
      },
      docEvidence,
      toolEvidence
    });

    expect(result.valid).toBe(false);
  });

  it("rejects claims that do not overlap with their cited evidence", () => {
    const result = validateInvestigationAnswer({
      answer: {
        customerReplyClaims: [
          {
            text: "Password rotation requires an owner approval workflow.",
            citations: ["S1"]
          }
        ],
        internalDiagnosisClaims: [],
        openQuestions: [],
        insufficientSupport: false
      },
      docEvidence,
      toolEvidence
    });

    expect(result).toEqual({
      valid: false,
      reason: "Claim does not appear supported by its cited evidence."
    });
  });

  it("rejects ready investigation claims that omit cited recent-error codes", () => {
    const result = validateInvestigationAnswer({
      answer: {
        customerReplyClaims: [
          {
            text: "The export failed because the actor lacked write permission.",
            citations: ["T1"]
          }
        ],
        internalDiagnosisClaims: [],
        openQuestions: [],
        insufficientSupport: false
      },
      docEvidence: [],
      toolEvidence: [
        {
          id: "T1",
          sourceType: "tool",
          toolName: "getRecentErrors",
          title: "Recent errors",
          excerpt: "ERR-219: Export actor had read access but lacked Exports: Write.",
          raw: []
        }
      ]
    });

    expect(result).toEqual({
      valid: false,
      reason: "Missing required diagnostic token ERR-219."
    });
  });
});
