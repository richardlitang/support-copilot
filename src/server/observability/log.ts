import { randomUUID } from "node:crypto";

type LogData = Record<string, unknown>;
type LogLevel = "info" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = { info: 0, error: 1 };

function getConfiguredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "error") return "error";
  return "info";
}

function emit(
  level: LogLevel,
  route: string,
  requestId: string,
  event: string,
  data?: LogData,
) {
  if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[getConfiguredLevel()]) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    route,
    requestId,
    event,
    ...(data ?? {}),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}

export function createRequestLogger(route: string, baseData?: LogData) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  function info(event: string, data?: LogData) {
    emit("info", route, requestId, event, {
      ...(baseData ?? {}),
      ...(data ?? {}),
    });
  }

  function error(event: string, data?: LogData) {
    emit("error", route, requestId, event, {
      ...(baseData ?? {}),
      ...(data ?? {}),
    });
  }

  function finish(data?: LogData) {
    info("request_finished", {
      durationMs: Date.now() - startedAt,
      ...(data ?? {}),
    });
  }

  return {
    requestId,
    info,
    error,
    finish,
  };
}
