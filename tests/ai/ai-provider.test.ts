import { createMockEmbedding, createEmbeddings } from "@/src/server/ai/provider";

describe("AI provider selection", () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalAiProvider;
    }

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("creates deterministic 1536-dimensional mock embeddings", () => {
    const first = createMockEmbedding("export failed after setup");
    const second = createMockEmbedding("export failed after setup");

    expect(first).toHaveLength(1536);
    expect(second).toEqual(first);
    expect(first.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("does not require OpenAI credentials when AI_PROVIDER=mock", async () => {
    process.env.AI_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;

    const embeddings = await createEmbeddings(["one", "two"]);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(1536);
  });
});
