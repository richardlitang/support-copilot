import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let envLoaded = false;
const projectRoot = process.cwd();
export type AiProviderName = "mock" | "openai" | "ollama";

function stripQuotes(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFileManually(filename: string) {
  const fullPath = path.join(/* turbopackIgnore: true */ projectRoot, filename);

  if (!existsSync(fullPath)) {
    return;
  }

  const content = readFileSync(fullPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  loadEnvFileManually(".env.local");
  loadEnvFileManually(".env");
  envLoaded = true;
}

function readOptionalString(key: string) {
  ensureEnvLoaded();
  const value = process.env[key]?.trim();
  return value ? value : "";
}

function readRequiredString(key: string) {
  const value = readOptionalString(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readNumber(key: string, fallback: number) {
  const value = readOptionalString(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a number.`);
  }

  return parsed;
}

export function getRuntimeConfig() {
  ensureEnvLoaded();
  const aiProvider = (readOptionalString("AI_PROVIDER") || "mock") as AiProviderName;

  if (!["mock", "openai", "ollama"].includes(aiProvider)) {
    throw new Error("AI_PROVIDER must be one of: mock, openai, ollama.");
  }

  if (aiProvider === "openai") {
    readRequiredString("OPENAI_API_KEY");
  }

  if (aiProvider === "ollama" && !readOptionalString("OLLAMA_BASE_URL")) {
    throw new Error("OLLAMA_BASE_URL is required when AI_PROVIDER=ollama.");
  }

  return {
    nodeEnv: readOptionalString("NODE_ENV") || "development",
    appUrl: readOptionalString("APP_URL") || "http://localhost:3000",
    databaseUrl: readOptionalString("DATABASE_URL"),
    redisUrl: readOptionalString("REDIS_URL") || "redis://localhost:6379",
    aiProvider,
    uploadDir: readOptionalString("UPLOAD_DIR") || "uploads",
    maxUploadMb: readNumber("MAX_UPLOAD_MB", 10),
    logLevel: readOptionalString("LOG_LEVEL") || "info",
    debugMode: readOptionalString("DEBUG_MODE") === "true"
  };
}

export function hasDirectDatabaseConfig() {
  return Boolean(getRuntimeConfig().databaseUrl);
}
