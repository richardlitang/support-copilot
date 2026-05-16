import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/src/server/config/env";
import { checkDatabaseReady } from "@/src/server/db/health";
import { checkRedisReady } from "@/src/server/queue/client";

type CheckStatus = "ok" | "failed" | "skipped";

export async function GET() {
  const checks: Record<string, CheckStatus> = {
    database: "skipped",
    redis: "skipped",
    aiProvider: "skipped",
  };
  const config = getRuntimeConfig();

  try {
    if (config.databaseUrl) {
      await checkDatabaseReady();
      checks.database = "ok";
    }
  } catch {
    checks.database = "failed";
  }

  try {
    await checkRedisReady();
    checks.redis = "ok";
  } catch {
    checks.redis = "failed";
  }

  checks.aiProvider = config.aiProvider === "mock" ? "skipped" : "ok";

  const ready = Object.values(checks).every((status) => status === "ok" || status === "skipped");

  return NextResponse.json(
    {
      status: ready ? "ok" : "error",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
