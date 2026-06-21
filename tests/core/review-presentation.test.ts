import { describe, expect, it } from "vitest";
import { reviewTone } from "@/lib/review-presentation";

describe("reviewTone", () => {
  it("uses calm ember-on-parchment when unacknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: false });
    expect(tone.accent).toBe("text-ember");
    expect(tone.surface).toContain("parchment");
  });
  it("switches to sage once acknowledged", () => {
    const tone = reviewTone({ reviewStatus: "needs_human_review", acknowledged: true });
    expect(tone.accent).toBe("text-sage");
  });
});
