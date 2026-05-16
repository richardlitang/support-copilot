import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountContext } from "@/src/server/tools/account-context";
import { getFeatureFlags } from "@/src/server/tools/feature-flags";
import { getRecentErrors } from "@/src/server/tools/recent-errors";

const dbMock = vi.hoisted(() => ({
  getAccountById: vi.fn(),
  listFeatureFlagsByAccountId: vi.fn(),
  listRecentErrorsByAccountId: vi.fn(),
}));

vi.mock("@/src/server/db", () => dbMock);

describe("tool modules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns account context from the database adapter", async () => {
    dbMock.getAccountById.mockResolvedValue({
      id: "acct-1",
      name: "Acme",
      planTier: "Growth",
      status: "active",
      enabledModules: ["exports"],
      limits: {},
      createdAt: "2026-04-15T00:00:00.000Z",
    });

    await expect(getAccountContext("acct-1")).resolves.toMatchObject({
      id: "acct-1",
      planTier: "Growth",
    });
  });

  it("returns feature flags from the database adapter", async () => {
    dbMock.listFeatureFlagsByAccountId.mockResolvedValue([
      {
        id: "flag-1",
        accountId: "acct-1",
        flagKey: "exports_ui_visible",
        flagValue: false,
        description: null,
        rolloutNotes: null,
        createdAt: "2026-04-15T00:00:00.000Z",
      },
    ]);

    await expect(getFeatureFlags("acct-1")).resolves.toHaveLength(1);
  });

  it("returns recent errors from the database adapter", async () => {
    dbMock.listRecentErrorsByAccountId.mockResolvedValue([
      {
        id: "error-1",
        accountId: "acct-1",
        productArea: "exports",
        errorCode: "ERR-219",
        summary: "Missing permission.",
        occurredAt: "2026-04-15T00:00:00.000Z",
        createdAt: "2026-04-15T00:00:00.000Z",
      },
    ]);

    await expect(
      getRecentErrors({ accountId: "acct-1", productArea: "exports" }),
    ).resolves.toHaveLength(1);
  });
});
