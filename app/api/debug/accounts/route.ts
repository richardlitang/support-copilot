import { NextResponse } from "next/server";
import { listAccountsSafe } from "@/src/server/db/supportContext";
import { createRequestLogger } from "@/src/server/observability/log";
import { captureServerException } from "@/src/server/observability/sentry";
import { getRuntimeConfig } from "@/src/server/config/env";

export async function GET() {
  const logger = createRequestLogger("/api/debug/accounts:get");

  if (!getRuntimeConfig().debugMode) {
    logger.finish({ outcome: "disabled" });
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const accounts = await listAccountsSafe();
    logger.finish({
      outcome: "success",
      accountCount: accounts.length,
    });
    const response = NextResponse.json({ accounts });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load debug accounts.";
    captureServerException(error, {
      tags: {
        route: "/api/debug/accounts:get",
        requestId: logger.requestId,
      },
    });
    logger.error("debug_accounts_get_failed", { message });
    logger.finish({ outcome: "request_error" });
    const response = NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
