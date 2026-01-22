import { determineReviewStatus, shouldEscalateToHumanReview } from "@/lib/review-policy";
import { determineSupportLevelV2 } from "@/lib/support-level";

describe("determineSupportLevelV2", () => {
  it("returns high support for strong cited documentation output", () => {
    const result = determineSupportLevelV2({
      topDocScore: 0.88,
      secondDocScore: 0.76,
      docEvidenceCount: 2,
      toolEvidenceCount: 0,
      customerClaimCount: 2,
      internalClaimCount: 2,
      hasConflict: false,
      missingRequiredContext: false,
      validationFailed: false
    });

    expect(result).toBe("high");
  });

  it("returns insufficient support when required context is missing", () => {
    const result = determineSupportLevelV2({
      topDocScore: 0.74,
      secondDocScore: 0.6,
      docEvidenceCount: 2,
      toolEvidenceCount: 0,
      customerClaimCount: 1,
      internalClaimCount: 1,
      hasConflict: false,
      missingRequiredContext: true,
      validationFailed: false
    });

    expect(result).toBe("insufficient_support");
  });

  it("returns low support for usable cited evidence instead of forcing human review", () => {
    const result = determineSupportLevelV2({
      topDocScore: 0.54,
      secondDocScore: 0.48,
      docEvidenceCount: 2,
      toolEvidenceCount: 1,
      customerClaimCount: 1,
      internalClaimCount: 1,
      hasConflict: false,
      missingRequiredContext: false,
      validationFailed: false
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
        hasConflict: false,
        missingRequiredContext: false,
        validationFailed: false
      })
    ).toBe("needs_human_review");
  });

  it("escalates when docs and tool evidence conflict", () => {
    expect(
      shouldEscalateToHumanReview({
        hasConflict: true,
        missingRequiredContext: false,
        supportLevel: "medium",
        validationFailed: false
      })
    ).toBe(true);
  });
});
