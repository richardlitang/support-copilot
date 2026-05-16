export const answerSchema = {
  name: "support_copilot_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: {
        type: "string",
      },
      claims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
            },
            citationIds: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: ["text", "citationIds"],
        },
      },
      supportLevel: {
        type: "string",
        enum: ["high", "medium", "low", "insufficient_support"],
      },
      citations: {
        type: "array",
        items: {
          type: "string",
        },
      },
      insufficientSupport: {
        type: "boolean",
      },
    },
    required: ["answer", "claims", "supportLevel", "citations", "insufficientSupport"],
  },
} as const;

export const investigationAnswerSchema = {
  name: "support_copilot_investigation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      customerReplyClaims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            citations: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["text", "citations"],
        },
      },
      internalDiagnosisClaims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            citations: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["text", "citations"],
        },
      },
      openQuestions: {
        type: "array",
        items: { type: "string" },
      },
      insufficientSupport: {
        type: "boolean",
      },
    },
    required: [
      "customerReplyClaims",
      "internalDiagnosisClaims",
      "openQuestions",
      "insufficientSupport",
    ],
  },
} as const;

export type StructuredInvestigationDraft = {
  customerReplyClaims: Array<{ text: string; citations: string[] }>;
  internalDiagnosisClaims: Array<{ text: string; citations: string[] }>;
  openQuestions: string[];
  insufficientSupport: boolean;
};
