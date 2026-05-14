import { getPgPool } from "@/src/server/db/client";

export async function checkDatabaseReady() {
  await getPgPool().query("select 1");
}
