import {
  buildInsufficientSupportAnswer,
  generateGroundedAnswer,
  validateGroundedAnswer,
} from "@/src/server/ai/answer";

describe("generateGroundedAnswer", () => {
  it("returns insufficient support when there is no evidence", async () => {
    const result = await generateGroundedAnswer({
      ticket: "Unknown question",
      evidence: [],
    });

    expect(result).toEqual(buildInsufficientSupportAnswer());
  });
});

describe("validateGroundedAnswer", () => {
  const evidence = [
    {
      id: "chunk-1",
      documentId: "doc-1",
      filename: "exports.md",
      sectionTitle: "Common export failures",
      content:
        "Exports fail when billing setup is incomplete or the actor lacks Exports: Write permission.",
      score: 0.82,
      rank: 1,
      chunkIndex: 0,
    },
  ];

  it("accepts short cited claims and rebuilds the answer from them", () => {
    const validated = validateGroundedAnswer({
      answer: {
        answer: "Ignore me",
        claims: [
          {
            text: "Exports can fail if billing setup is incomplete.",
            citationIds: ["s1"],
          },
        ],
        supportLevel: "medium",
        citations: ["S1"],
        insufficientSupport: false,
      },
      evidence,
    });

    expect(validated.valid).toBe(true);

    if (!validated.valid) {
      throw new Error("Expected grounded answer to validate.");
    }

    expect(validated.answer.claims).toEqual([
      {
        text: "Exports can fail if billing setup is incomplete.",
        citationIds: ["S1"],
      },
    ]);
    expect(validated.answer.answer).toContain("[S1]");
  });

  it("rejects claims without valid citations", () => {
    const validated = validateGroundedAnswer({
      answer: {
        answer: "Ignore me",
        claims: [
          {
            text: "Exports fail for many possible reasons.",
            citationIds: [],
          },
        ],
        supportLevel: "low",
        citations: [],
        insufficientSupport: false,
      },
      evidence,
    });

    expect(validated.valid).toBe(false);
  });
});
