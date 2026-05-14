import { hasDirectDatabaseConfig } from "@/lib/env";
import { withPgClient } from "@/src/server/db/client";

const forbiddenMetadataKeys = new Set([
  "documentText",
  "rawText",
  "text",
  "prompt",
  "messages",
  "response",
  "completion",
  "embedding",
  "embeddings",
  "chunks",
  "chunkContent",
  "ticket",
  "question",
  "headers",
  "cookies",
  "apiKey",
  "secret",
  "token"
]);

function sanitizeMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (forbiddenMetadataKeys.has(key)) {
        return false;
      }

      return typeof value !== "function" && typeof value !== "symbol";
    })
  );
}

export function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected failure";

  if (/openai|embedding|provider|fetch|network|timeout/i.test(message)) {
    return {
      errorCode: "PROVIDER_REQUEST_FAILED",
      errorMessageSafe: "Provider request failed"
    };
  }

  if (/parse|pdf|text/i.test(message)) {
    return {
      errorCode: "DOCUMENT_PARSE_FAILED",
      errorMessageSafe: "Document parsing failed"
    };
  }

  return {
    errorCode: "INTERNAL_ERROR",
    errorMessageSafe: "Internal processing failed"
  };
}

export async function recordPipelineEvent(input: {
  eventType: string;
  status: "started" | "completed" | "failed" | "skipped";
  entityType: string;
  entityId: string;
  sessionId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
}) {
  if (!hasDirectDatabaseConfig()) {
    return;
  }

  const metadata = sanitizeMetadata(input.metadata);

  await withPgClient(async (client) => {
    await client.query(
      `
        insert into pipeline_events (
          event_type,
          status,
          entity_type,
          entity_id,
          session_id,
          tenant_id,
          user_id,
          duration_ms,
          metadata_json,
          error_code,
          error_message_safe
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        input.eventType,
        input.status,
        input.entityType,
        input.entityId,
        input.sessionId ?? null,
        input.tenantId ?? null,
        input.userId ?? null,
        input.durationMs ?? null,
        JSON.stringify(metadata),
        input.errorCode ?? null,
        input.errorMessageSafe ?? null
      ]
    );
  });
}
