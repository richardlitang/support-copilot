import { listRecentErrorsByAccountIdDirect as listRecentErrorsByAccountId } from "@/src/server/db/supportContext";

export async function getRecentErrors(input: {
  accountId: string;
  productArea?: string | null;
  limit?: number;
}) {
  return listRecentErrorsByAccountId(input);
}
