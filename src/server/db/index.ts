import { listDocumentsRecord } from "@/src/server/db/documentRecords";
import { hasDatabaseConfig } from "@/src/server/db/supabaseAdmin";
import { listAccountsDirect } from "@/src/server/db/supportContext";

function emitPerf(event: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      route: "db",
      event,
      ...(data ?? {}),
    }),
  );
}

export async function listDocumentsSafe(sessionId?: string | null) {
  if (!hasDatabaseConfig() || !sessionId) {
    emitPerf("listDocumentsSafe_skipped", {
      hasDatabaseConfig: hasDatabaseConfig(),
      hasSessionId: Boolean(sessionId),
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const documents = await listDocumentsRecord(sessionId);
    emitPerf("listDocumentsSafe_completed", {
      sessionId,
      documentCount: documents.length,
      durationMs: Date.now() - startedAt,
    });
    return documents;
  } catch (error) {
    emitPerf("listDocumentsSafe_failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function listAccountsSafe() {
  if (!hasDatabaseConfig()) {
    emitPerf("listAccountsSafe_skipped", {
      hasDatabaseConfig: false,
    });
    return [];
  }

  const startedAt = Date.now();

  try {
    const accounts = await listAccountsDirect();
    emitPerf("listAccountsSafe_completed", {
      accountCount: accounts.length,
      durationMs: Date.now() - startedAt,
    });
    return accounts;
  } catch (error) {
    emitPerf("listAccountsSafe_failed", {
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
