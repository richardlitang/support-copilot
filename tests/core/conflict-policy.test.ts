import { accountHasModule, detectConflict, findRelevantFlags } from "@/lib/conflict-policy";
import type { AccountRecord, DocEvidenceItem, FeatureFlagRecord } from "@/lib/types/investigation";

const account: AccountRecord = {
  id: "acct-1",
  name: "Acme",
  planTier: "Enterprise",
  status: "active",
  enabledModules: ["exports"],
  limits: {},
  createdAt: "2026-01-01T00:00:00Z",
};

const docEvidence: DocEvidenceItem[] = [
  {
    id: "S1",
    sourceType: "doc",
    documentId: "doc-1",
    filename: "exports.md",
    sectionTitle: "Exports",
    excerpt: "Exports are available when the account has the module and required permission.",
    score: 0.85,
    chunkIndex: 0,
  },
];

const enabledExportFlag: FeatureFlagRecord = {
  id: "flag-1",
  accountId: "acct-1",
  flagKey: "exports_ui",
  flagValue: true,
  description: null,
  rolloutNotes: null,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("conflict-policy", () => {
  it("matches relevant flags and account modules by product area", () => {
    expect(findRelevantFlags([enabledExportFlag], "exports")).toEqual([enabledExportFlag]);
    expect(findRelevantFlags([enabledExportFlag], "imports")).toEqual([]);
    expect(accountHasModule(account, "exports")).toBe(true);
    expect(accountHasModule(account, "imports")).toBe(false);
  });

  it("flags unexplained failures when docs and healthy tool state do not explain the issue", () => {
    expect(
      detectConflict({
        mode: "docs_plus_tools",
        ticket: "Exports are not working",
        docEvidence,
        account,
        flags: [enabledExportFlag],
        errors: [],
        missingRequiredContext: false,
      }),
    ).toEqual({
      hasConflict: true,
      reason: "Docs and current tool state do not explain the reported issue.",
    });
  });

  it("does not flag conflict when tool state explains the issue", () => {
    expect(
      detectConflict({
        mode: "docs_plus_tools",
        ticket: "Exports are not working",
        docEvidence,
        account: {
          ...account,
          enabledModules: [],
        },
        flags: [enabledExportFlag],
        errors: [],
        missingRequiredContext: false,
      }),
    ).toEqual({
      hasConflict: false,
      reason: null,
    });
  });
});
