import { listFeatureFlagsByAccountId } from "@/src/server/db";

export async function getFeatureFlags(accountId: string) {
  return listFeatureFlagsByAccountId(accountId);
}
