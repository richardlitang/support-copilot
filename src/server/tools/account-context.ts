import { getAccountById } from "@/src/server/db/supportContext";

export async function getAccountContext(accountId: string) {
  return getAccountById(accountId);
}
