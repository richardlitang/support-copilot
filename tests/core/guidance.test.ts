import { describe, expect, it } from "vitest";
import { resolveNextAction, setupSteps } from "@/lib/guidance";

describe("resolveNextAction", () => {
  it("asks for docs first when none uploaded", () => {
    const next = resolveNextAction({ documentCount: 0, ticketText: "" });
    expect(next.stage).toBe("docs");
    expect(next.index).toBe(1);
    expect(next.label).toContain("Add support docs");
  });
  it("asks for the ticket once docs exist but ticket is empty", () => {
    const next = resolveNextAction({ documentCount: 2, ticketText: "   " });
    expect(next.stage).toBe("ticket");
    expect(next.index).toBe(2);
  });
  it("offers to run once docs and ticket are present", () => {
    const next = resolveNextAction({ documentCount: 2, ticketText: "Refund failed" });
    expect(next.stage).toBe("investigate");
    expect(next.index).toBe(3);
  });
});

describe("setupSteps", () => {
  it("marks docs done, ticket active, investigate upcoming mid-flow", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "" });
    expect(steps.map((s) => s.state)).toEqual(["done", "active", "upcoming"]);
  });
  it("marks all done-then-active when ready to run", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "hi" });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active"]);
  });
});
