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

  it("formats mock answers from support-guide meaning entries", async () => {
    const result = await generateGroundedAnswer({
      ticket: "duplicate_payment_attempt what does it mean",
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "paybridge-api-support-guide.pdf",
          sectionTitle: null,
          content:
            "`duplicate_payment_attempt` - **Meaning:** The platform detected a second payment attempt for an order that already has a successful payment.",
          score: 0.62,
          rank: 1,
          chunkIndex: 0,
        },
      ],
    });

    expect(result.claims[0]?.text).toBe(
      "duplicate_payment_attempt means the platform detected a second payment attempt for an order that already has a successful payment.",
    );
    expect(result.claims[0]?.citationIds).toEqual(["S1"]);
  });

  it("turns a payment-method fact-sheet field into a direct customer answer", async () => {
    const result = await generateGroundedAnswer({
      ticket: "Does EPS have recurring Payments",
      evidence: [
        {
          id: "chunk-eps",
          documentId: "doc-1",
          filename: "Payment-methods-guide.pdf",
          sectionTitle: null,
          content:
            "PAYMENT METHOD TYPE Authenticated bank debit RECURRING PAYMENTS No EPS EPS is an Austrian online transfer payment method with approximately 18% market share.",
          score: 0.91,
          rank: 1,
          chunkIndex: 36,
        },
      ],
    });

    expect(result.claims).toEqual([
      {
        text:
          "No. EPS does not support recurring payments. EPS is an Austrian online transfer payment method with approximately 18% market share.",
        citationIds: ["S1"],
      },
    ]);
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
