import { listFeatureFlagsByAccountId } from "@/src/server/db/supportContext";

export async function getFeatureFlags(accountId: string) {
  return listFeatureFlagsByAccountId(accountId);
}
