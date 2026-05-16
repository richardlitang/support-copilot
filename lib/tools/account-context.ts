import { getAccountById } from "@/src/server/db";

export async function getAccountContext(accountId: string) {
  return getAccountById(accountId);
}
