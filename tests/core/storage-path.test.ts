import { describe, expect, it } from "vitest";
import { buildStoragePath, extensionFromFilename } from "@/src/server/storage/storagePath";

describe("extensionFromFilename", () => {
  it("returns the lowercased extension", () => {
    expect(extensionFromFilename("Report.PDF")).toBe(".pdf");
  });
  it("returns empty for no/oversized extension", () => {
    expect(extensionFromFilename("noext")).toBe("");
    expect(extensionFromFilename("a.superlongextension")).toBe("");
  });
});

describe("buildStoragePath", () => {
  it("uses the provided documentId and original<ext>", () => {
    expect(buildStoragePath({ filename: "x.pdf", documentId: "doc-1" })).toBe("doc-1/original.pdf");
  });
  it("generates a documentId when absent", () => {
    const p = buildStoragePath({ filename: "x.pdf" });
    expect(p).toMatch(/^[0-9a-f-]{36}\/original\.pdf$/);
  });
});
