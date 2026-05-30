import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { determineSupportLevel } from "@/lib/support-level";

describe("determineSupportLevel", () => {
  it("returns high support for strong cited documentation output", () => {
    const result = determineSupportLevel({
      topDocScore: 0.88,
      secondDocScore: 0.76,
      docEvidenceCount: 2,
      toolEvidenceCount: 0,
      customerClaimCount: 2,
      internalClaimCount: 2,
      blocker: { kind: "none" },
    });

    expect(result).toBe("high");
  });

  it("returns insufficient support when required context is missing", () => {
    const result = determineSupportLevel({
      topDocScore: 0.74,
      secondDocScore: 0.6,
      docEvidenceCount: 2,
      toolEvidenceCount: 0,
      customerClaimCount: 1,
      internalClaimCount: 1,
      blocker: { kind: "missing_context" },
    });

    expect(result).toBe("insufficient_support");
  });

  it("returns low support for usable cited evidence instead of forcing human review", () => {
    const result = determineSupportLevel({
      topDocScore: 0.54,
      secondDocScore: 0.48,
      docEvidenceCount: 2,
      toolEvidenceCount: 1,
      customerClaimCount: 1,
      internalClaimCount: 1,
      blocker: { kind: "none" },
    });

    expect(result).toBe("low");
  });

  it("returns low support for validated multi-source checklist evidence just below the single-source threshold", () => {
    const result = determineSupportLevel({
      topDocScore: 0.49,
      secondDocScore: 0.48,
      docEvidenceCount: 3,
      toolEvidenceCount: 0,
      customerClaimCount: 2,
      internalClaimCount: 2,
      blocker: { kind: "none" },
    });

    expect(result).toBe("low");
  });
});

describe("review policy", () => {
  it("marks review as required when support is insufficient", () => {
    expect(
      determineReviewStatus({
        mode: "docs_only",
        supportLevel: "insufficient_support",
        blocker: { kind: "none" },
      }),
    ).toBe("needs_human_review");
  });

  it("escalates when docs and tool evidence conflict", () => {
    expect(
      shouldEscalateToHumanReview({
        blocker: { kind: "conflict", reason: "Docs and tool state conflict." },
        supportLevel: "medium",
      }),
    ).toBe(true);
  });
});
