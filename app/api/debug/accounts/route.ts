import { NextResponse } from "next/server";
import { listAccountsSafe } from "@/lib/db";
import { createRequestLogger } from "@/lib/log";

export async function GET() {
  const logger = createRequestLogger("/api/debug/accounts:get");

  try {
    const accounts = await listAccountsSafe();
    logger.finish({
      outcome: "success",
      accountCount: accounts.length
    });
    const response = NextResponse.json({ accounts });
    response.headers.set("x-request-id", logger.requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load debug accounts.";
    logger.error("debug_accounts_get_failed", { message });
    logger.finish({ outcome: "request_error" });
    const response = NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
    response.headers.set("x-request-id", logger.requestId);
    return response;
  }
}
