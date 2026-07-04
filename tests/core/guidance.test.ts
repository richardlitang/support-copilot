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
  it("moves to review while a run is in flight", () => {
    const next = resolveNextAction({
      documentCount: 2,
      ticketText: "Refund failed",
      isInvestigating: true,
    });
    expect(next.stage).toBe("review");
    expect(next.index).toBe(4);
  });
  it("moves to review once a result exists", () => {
    const next = resolveNextAction({
      documentCount: 2,
      ticketText: "Refund failed",
      hasResult: true,
    });
    expect(next.stage).toBe("review");
    expect(next.index).toBe(4);
    expect(next.label).toContain("Review");
  });
  it("asks for a new ticket after a result when the ticket is cleared", () => {
    const next = resolveNextAction({ documentCount: 2, ticketText: "", hasResult: false });
    expect(next.stage).toBe("ticket");
  });
});

describe("setupSteps", () => {
  it("marks docs done, ticket active, run and review upcoming mid-flow", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "" });
    expect(steps.map((s) => s.state)).toEqual(["done", "active", "upcoming", "upcoming"]);
  });
  it("marks run active when ready to run", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "hi" });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active", "upcoming"]);
  });
  it("marks review active once a result exists", () => {
    const steps = setupSteps({ documentCount: 1, ticketText: "hi", hasResult: true });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "active"]);
  });
});
