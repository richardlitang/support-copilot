import { listRecentErrorsByAccountId } from "@/src/server/db";

export async function getRecentErrors(input: {
  accountId: string;
  productArea?: string | null;
  limit?: number;
}) {
  return listRecentErrorsByAccountId(input);
}
