import { collectToolArtifacts, inferProductArea } from "@/lib/tool-runner";
import type { AccountRecord, ErrorEventRecord, FeatureFlagRecord } from "@/lib/types/investigation";

const account: AccountRecord = {
  id: "acct-1",
  name: "Acme",
  planTier: "Growth",
  status: "active",
  enabledModules: ["exports"],
  limits: { exportRows: 50000 },
  createdAt: "2026-01-01T00:00:00Z",
};

const flags: FeatureFlagRecord[] = [
  {
    id: "flag-1",
    accountId: "acct-1",
    flagKey: "exports_ui",
    flagValue: true,
    description: "Exports UI enabled",
    rolloutNotes: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

const errors: ErrorEventRecord[] = [
  {
    id: "err-1",
    accountId: "acct-1",
    productArea: "exports",
    errorCode: "ERR-219",
    summary: "Missing export permission",
    occurredAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("tool-runner", () => {
  it("infers product areas from ticket language", () => {
    expect(inferProductArea("Exports are failing")).toBe("exports");
    expect(inferProductArea("CSV import froze")).toBe("imports");
    expect(inferProductArea("Billing is blocked")).toBe("billing");
    expect(inferProductArea("CRM integration install failed")).toBe("integrations");
    expect(inferProductArea("Something happened")).toBeNull();
  });

  it("collects selected account tool evidence with canonical T citations", async () => {
    const result = await collectToolArtifacts({
      requiredTools: ["getAccountContext", "getFeatureFlags", "getRecentErrors"],
      selectedAccountId: "acct-1",
      ticket: "Exports are failing",
      dependencies: {
        getAccountContext: async () => account,
        getFeatureFlags: async () => flags,
        getRecentErrors: async () => errors,
      },
    });

    expect(result.productArea).toBe("exports");
    expect(result.toolEvidence.map((item) => item.id)).toEqual(["T1", "T2", "T3"]);
    expect(result.toolEvidence[0]?.excerpt).toContain("Plan: Growth");
    expect(result.toolCalls[2]?.input).toEqual({ accountId: "acct-1", productArea: "exports" });
    expect(result.account).toEqual(account);
    expect(result.flags).toEqual(flags);
    expect(result.errors).toEqual(errors);
  });

  it("returns inspectable not-run evidence when account tools are requested without an account", async () => {
    const result = await collectToolArtifacts({
      requiredTools: ["getAccountContext"],
      selectedAccountId: null,
      ticket: "Why is this workspace missing exports?",
      dependencies: {
        getAccountContext: async () => account,
        getFeatureFlags: async () => flags,
        getRecentErrors: async () => errors,
      },
    });

    expect(result.toolEvidence[0]).toMatchObject({
      id: "T1",
      title: "Tool not run",
      raw: {
        status: "not_run",
        reason: "missing_seeded_account",
      },
    });
    expect(result.toolCalls[0]?.input).toEqual({ accountId: null });
  });
});
