import { chunkParsedDocument } from "@/lib/chunk";
import { parseTextDocument } from "@/src/server/ingestion/parse";

describe("chunkParsedDocument", () => {
  it("preserves markdown headings in chunk metadata", () => {
    const parsed = parseTextDocument({
      filename: "guide.md",
      contentType: "text/markdown",
      text: "# Setup\nFirst paragraph.\n\nSecond paragraph.\n\n## Permissions\nNeed write access.",
    });
    const chunks = chunkParsedDocument(parsed, {
      maxChars: 80,
      overlapChars: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.sectionTitle).toBe("Setup");
    expect(chunks.at(-1)?.sectionTitle).toBe("Permissions");
  });

  it("keeps troubleshooting table rows with their corrective actions", () => {
    const parsed = parseTextDocument({
      filename: "compressor-troubleshooting.txt",
      contentType: "text/plain",
      text: [
        "Troubleshooting",
        "",
        "MALFUNCTION/FAULT POSSIBLE CAUSE CORRECTIVE ACTION",
        "Compressor uses too much oil Clogged inlet filter Clean inlet filter or replace if necessary",
        "Wrong oil being used; wrong viscosity Drain and replace oil",
        "Oil level too high Fill compressor with oil to proper level",
        "Crankcase breather valve malfunction Replace crankcase breather",
        "Compressor runs unloaded too long Increase load or stop compressor when not needed",
      ].join("\n"),
    });

    const chunks = chunkParsedDocument(parsed, {
      maxChars: 220,
      overlapChars: 20,
    });
    const oilUsageChunks = chunks.filter((chunk) =>
      chunk.content.includes("Compressor uses too much oil"),
    );

    expect(oilUsageChunks.length).toBeGreaterThan(0);
    expect(oilUsageChunks[0]?.content).toContain("Clogged inlet filter");
    expect(oilUsageChunks[0]?.content).toContain("Clean inlet filter or replace if necessary");
    expect(
      chunks.some(
        (chunk) =>
          chunk.content.includes("Wrong oil being used") &&
          chunk.content.includes("Drain and replace oil"),
      ),
    ).toBe(true);
  });
});
