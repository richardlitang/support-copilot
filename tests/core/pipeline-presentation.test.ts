import { describe, expect, it } from "vitest";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";

describe("pipelineStepAccent", () => {
  it("maps complete to sage", () => {
    expect(pipelineStepAccent("complete").text).toBe("text-sage");
  });
  it("maps blocked to ember", () => {
    expect(pipelineStepAccent("blocked").text).toBe("text-ember");
  });
  it("maps skipped to a muted accent, not signal", () => {
    const accent = pipelineStepAccent("skipped");
    expect(accent.text).toBe("text-zinc-400");
    expect(accent.text).not.toBe("text-signal");
  });
  it("defaults unknown/active to signal", () => {
    expect(pipelineStepAccent("active").text).toBe("text-signal");
  });
});

describe("isStepRevealed", () => {
  it("reveals indices below the playhead", () => {
    expect(isStepRevealed(0, 1)).toBe(true);
    expect(isStepRevealed(1, 1)).toBe(false);
  });
});
