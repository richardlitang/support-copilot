import { listFeatureFlagsByAccountIdDirect as listFeatureFlagsByAccountId } from "@/src/server/db/supportContext";

export async function getFeatureFlags(accountId: string) {
  return listFeatureFlagsByAccountId(accountId);
}
