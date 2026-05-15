import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteDocumentsByFilenameAndStatus,
  getSupabaseAdminClient,
  listDocuments,
} from "../lib/db";
import { directIngestParsedDocument } from "../lib/ingest";
import { parseTextDocument } from "../lib/parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDirectory = path.join(__dirname, "..", "demo", "docs");
const supportContextPath = path.join(__dirname, "..", "demo", "support-context.json");
const DEMO_SESSION_ID = "demo-seeded-session";

type SupportContextSeed = {
  accounts: Array<{
    id: string;
    name: string;
    planTier: string;
    status: string;
    enabledModules: string[];
    limits: Record<string, unknown>;
  }>;
  featureFlags: Array<{
    id: string;
    accountId: string;
    flagKey: string;
    flagValue: boolean;
    description: string | null;
    rolloutNotes: string | null;
  }>;
  errorEvents: Array<{
    id: string;
    accountId: string;
    productArea: string | null;
    errorCode: string;
    summary: string;
    occurredAt: string;
  }>;
};

async function seedSupportContext() {
  const supabase = getSupabaseAdminClient();
  const supportContext = JSON.parse(
    await readFile(supportContextPath, "utf8"),
  ) as SupportContextSeed;

  const { error: accountsError } = await supabase.from("accounts").upsert(
    supportContext.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      plan_tier: account.planTier,
      status: account.status,
      enabled_modules_json: account.enabledModules,
      limits_json: account.limits,
    })),
    { onConflict: "id" },
  );

  if (accountsError) {
    throw new Error(`Failed to seed accounts: ${accountsError.message}`);
  }

  const { error: flagsError } = await supabase.from("feature_flags").upsert(
    supportContext.featureFlags.map((flag) => ({
      id: flag.id,
      account_id: flag.accountId,
      flag_key: flag.flagKey,
      flag_value: flag.flagValue,
      description: flag.description,
      rollout_notes: flag.rolloutNotes,
    })),
    { onConflict: "id" },
  );

  if (flagsError) {
    throw new Error(`Failed to seed feature flags: ${flagsError.message}`);
  }

  const { error: errorEventsError } = await supabase.from("error_events").upsert(
    supportContext.errorEvents.map((event) => ({
      id: event.id,
      account_id: event.accountId,
      product_area: event.productArea,
      error_code: event.errorCode,
      summary: event.summary,
      occurred_at: event.occurredAt,
    })),
    { onConflict: "id" },
  );

  if (errorEventsError) {
    throw new Error(`Failed to seed error events: ${errorEventsError.message}`);
  }

  console.log(
    `Seeded support context: ${supportContext.accounts.length} accounts, ${supportContext.featureFlags.length} flags, ${supportContext.errorEvents.length} errors.`,
  );
}

async function main() {
  await seedSupportContext();

  const existingDocuments = await listDocuments(DEMO_SESSION_ID);
  const readyFilenames = new Set(
    existingDocuments
      .filter((document) => document.status === "ready")
      .map((document) => document.filename),
  );
  const failedFilenames = new Set(
    existingDocuments
      .filter((document) => document.status === "failed")
      .map((document) => document.filename),
  );
  const filenames = (await readdir(docsDirectory)).filter(
    (filename) => filename.endsWith(".md") || filename.endsWith(".txt"),
  );

  for (const filename of filenames) {
    if (readyFilenames.has(filename)) {
      console.log(`Skipping ${filename}: already ingested.`);
      continue;
    }

    if (failedFilenames.has(filename)) {
      await deleteDocumentsByFilenameAndStatus(filename, "failed", DEMO_SESSION_ID);
      console.log(`Retrying ${filename}: cleared failed document rows.`);
    }

    const fullPath = path.join(docsDirectory, filename);
    const text = await readFile(fullPath, "utf8");
    const parsed = parseTextDocument({
      filename,
      contentType: filename.endsWith(".md") ? "text/markdown" : "text/plain",
      text,
      sourceType: "demo",
    });
    const result = await directIngestParsedDocument({
      parsedDocument: parsed,
      sessionId: DEMO_SESSION_ID,
    });

    console.log(`Ingested ${filename}: ${result.chunkCount} chunks.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
