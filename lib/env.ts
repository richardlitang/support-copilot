import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let envLoaded = false;
const projectRoot = process.cwd();

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
