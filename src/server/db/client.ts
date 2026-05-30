import pg from "pg";
import { getRuntimeConfig } from "@/src/server/config/env";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPgPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = getRuntimeConfig().databaseUrl;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for direct Postgres access.");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  return pool;
}

export async function withPgClient<T>(callback: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPgPool().connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closePgPool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
