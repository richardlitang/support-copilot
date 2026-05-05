import { classifyInvestigation } from "@/lib/classify";

describe("classifyInvestigation", () => {
  it("keeps strong procedural tickets on the docs-only path", () => {
    const result = classifyInvestigation({
      ticketText: "How do I enable exports for a workspace?",
      selectedAccountId: null,
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "exports.md",
          sectionTitle: "Setup",
          content: "Exports are available on Growth and Enterprise.",
          score: 0.82,
          rank: 1,
          chunkIndex: 0
        }
      ]
    });

    expect(result.mode).toBe("docs_only");
    expect(result.requiredTools).toEqual([]);
  });

  it("routes to docs plus tools when account-specific access language is present and an account is selected", () => {
    const result = classifyInvestigation({
      ticketText: "Why can't this customer access exports on our account?",
      selectedAccountId: "acct-1",
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "feature-permissions.md",
          sectionTitle: "Exports",
          content: "Exports are available on Growth and Enterprise plans.",
          score: 0.77,
          rank: 1,
          chunkIndex: 0
        }
      ]
    });

    expect(result.mode).toBe("docs_plus_tools");
    expect(result.requiredTools).toContain("getAccountContext");
    expect(result.requiredTools).toContain("getFeatureFlags");
  });

  it("routes to docs plus tools when investigation context is provided without a seeded account", () => {
    const result = classifyInvestigation({
      ticketText: "Why can't this customer access exports on our account?",
      selectedAccountId: null,
      investigationContext: "Plan: Starter. Exports UI hidden. Support note: billing already complete.",
      evidence: []
    });

    expect(result.mode).toBe("docs_plus_tools");
    expect(result.requiredTools).toContain("getProvidedContext");
  });

  it("routes to needs human review when structured context is required but missing", () => {
    const result = classifyInvestigation({
      ticketText: "Why can't this customer access exports on our account?",
      selectedAccountId: null,
      evidence: []
    });

    expect(result.mode).toBe("needs_human_review");
    expect(result.routingReason).toContain("none was provided");
  });

  it("does not require account context for general plan-comparison questions", () => {
    const result = classifyInvestigation({
      ticketText: "Exports are dead on arrival after billing is done. Could Starter be the hidden blocker?",
      selectedAccountId: null,
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "plan-limits.md",
          sectionTitle: "Exports by plan",
          content: "Starter does not include exports. Growth and Enterprise include exports.",
          score: 0.8,
          rank: 1,
          chunkIndex: 0
        }
      ]
    });

    expect(result.mode).toBe("docs_only");
    expect(result.requiredTools).toEqual([]);
  });

  it("does not treat disabled webhook endpoint recovery as feature-flag context", () => {
    const result = classifyInvestigation({
      ticketText:
        "Our webhook endpoint was disabled overnight. Delivery logs show several 500 responses after our deployment. What should we do to re-enable it safely?",
      selectedAccountId: null,
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "paybridge-api-support-guide.md",
          sectionTitle: "webhook_endpoint_disabled",
          content: "Fix the endpoint, return a 2xx response quickly, and re-enable the endpoint in the dashboard.",
          score: 0.78,
          rank: 1,
          chunkIndex: 0
        }
      ]
    });

    expect(result.mode).toBe("docs_only");
    expect(result.requiredTools).toEqual([]);
  });

  it("still routes explicit disabled-feature tickets to context checks", () => {
    const result = classifyInvestigation({
      ticketText: "The exports feature is disabled for this account.",
      selectedAccountId: null,
      evidence: []
    });

    expect(result.mode).toBe("needs_human_review");
    expect(result.routingReason).toContain("none was provided");
  });

  it("uses selected account context for plan entitlement questions", () => {
    const result = classifyInvestigation({
      ticketText: "Can a Starter workspace use audit logs?",
      selectedAccountId: "acct-1",
      evidence: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          filename: "plan-limits.md",
          sectionTitle: "Audit logs",
          content: "Audit logs are available on Enterprise.",
          score: 0.8,
          rank: 1,
          chunkIndex: 0
        }
      ]
    });

    expect(result.mode).toBe("docs_plus_tools");
    expect(result.requiredTools).toContain("getAccountContext");
  });
});
