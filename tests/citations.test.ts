import { buildCitationReferences, normalizeCitationLabels } from "@/lib/citations";

describe("citations", () => {
  it("normalizes and deduplicates labels", () => {
    expect(normalizeCitationLabels([" s1 ", "S2", "s1", "S9"], ["S1", "S2"])).toEqual(["S1", "S2"]);
  });

  it("builds reference labels from ranked evidence", () => {
    const references = buildCitationReferences([
      {
        id: "chunk-1",
        documentId: "doc-1",
        filename: "guide.md",
        sectionTitle: "Setup",
        content: "Example excerpt for exports.",
        score: 0.81,
        rank: 1,
        chunkIndex: 0
      }
    ]);

    expect(references[0]).toMatchObject({
      label: "S1",
      filename: "guide.md",
      sectionTitle: "Setup"
    });
  });
});
