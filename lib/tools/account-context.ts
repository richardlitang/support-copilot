import { getAccountById } from "@/lib/db";

export async function getAccountContext(accountId: string) {
  return getAccountById(accountId);
}
