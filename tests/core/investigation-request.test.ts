import {
  MAX_INVESTIGATION_CONTEXT_LENGTH,
  MAX_TICKET_LENGTH,
  normalizeInvestigationRequest,
} from "@/lib/investigation-request";

describe("normalizeInvestigationRequest", () => {
  it("trims valid investigation input", () => {
    expect(
      normalizeInvestigationRequest({
        ticket: "  Export failed after setup  ",
        ragEnabled: false,
        selectedAccountId: " acct-1 ",
        investigationContext: " Plan: Starter ",
      }),
    ).toEqual({
      ticket: "Export failed after setup",
      executionMode: "draft_answer",
      ragEnabled: false,
      selectedAccountId: "acct-1",
      investigationContext: "Plan: Starter",
    });
  });

  it("accepts evidence-only mode", () => {
    expect(
      normalizeInvestigationRequest({
        ticket: "Export failed after setup",
        executionMode: "evidence_only",
      }),
    ).toMatchObject({
      executionMode: "evidence_only",
      ragEnabled: true,
    });
  });

  it("requires a support ticket", () => {
    expect(() => normalizeInvestigationRequest({ ticket: " " })).toThrow("Paste a support ticket");
  });

  it("rejects oversized model inputs", () => {
    expect(() =>
      normalizeInvestigationRequest({ ticket: "x".repeat(MAX_TICKET_LENGTH + 1) }),
    ).toThrow("Ticket is too long");
    expect(() =>
      normalizeInvestigationRequest({
        ticket: "Export failed",
        investigationContext: "x".repeat(MAX_INVESTIGATION_CONTEXT_LENGTH + 1),
      }),
    ).toThrow("Investigation context is too long");
  });
});
