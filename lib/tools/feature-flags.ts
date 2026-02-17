import { listFeatureFlagsByAccountId } from "@/lib/db";

export async function getFeatureFlags(accountId: string) {
  return listFeatureFlagsByAccountId(accountId);
}
