import { chunkParsedDocument } from "@/lib/chunk";
import { parseTextDocument } from "@/src/server/ingestion/parse";

describe("parseTextDocument", () => {
  it("cleans common PDF page headers before support error entries", () => {
    const parsed = parseTextDocument({
      filename: "paybridge-api-support-guide.pdf",
      contentType: "application/pdf",
      text: [
        "Page 5PayBridge API Support Guide - Demo Corpus duplicate_payment_attempt Meaning:",
        "The platform detected a second payment attempt for an order that already has a successful payment.",
        "Customer action: Do not create another payment for the same order.",
      ].join(" "),
    });
    const chunks = chunkParsedDocument(parsed, { maxChars: 500, overlapChars: 0 });

    expect(chunks[0]?.content).not.toContain("Page 5");
    expect(chunks[0]?.content).not.toContain("PayBridge API Support Guide - Demo Corpus");
    expect(chunks[0]?.content).toContain("`duplicate_payment_attempt` - **Meaning:**");
    expect(chunks[0]?.content).toContain("The platform detected a second payment attempt");
  });
});
