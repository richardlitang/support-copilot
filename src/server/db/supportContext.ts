import type { AccountRecord, ErrorEventRecord, FeatureFlagRecord } from "@/lib/types/investigation";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

type DbAccountRow = {
  id: string;
  name: string;
  plan_tier: string;
  status: string;
  enabled_modules_json: unknown;
  limits_json: unknown;
  created_at: string;
};

type DbFeatureFlagRow = {
  id: string;
  account_id: string;
  flag_key: string;
  flag_value: boolean;
  description: string | null;
  rollout_notes: string | null;
  created_at: string;
};

type DbErrorEventRow = {
  id: string;
  account_id: string;
  product_area: string | null;
  error_code: string;
  summary: string;
  occurred_at: string;
  created_at: string;
};

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapAccountRow(row: DbAccountRow): AccountRecord {
  return {
    id: row.id,
    name: row.name,
    planTier: row.plan_tier,
    status: row.status,
    enabledModules: readStringArray(row.enabled_modules_json),
    limits: readRecord(row.limits_json),
    createdAt: row.created_at,
  };
}

function mapFeatureFlagRow(row: DbFeatureFlagRow): FeatureFlagRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    flagKey: row.flag_key,
    flagValue: row.flag_value,
    description: row.description,
    rolloutNotes: row.rollout_notes,
    createdAt: row.created_at,
  };
}

function mapErrorEventRow(row: DbErrorEventRow): ErrorEventRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    productArea: row.product_area,
    errorCode: row.error_code,
    summary: row.summary,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export async function listAccountsDirect() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, plan_tier, status, enabled_modules_json, limits_json, created_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list accounts: ${error.message}`);
  }

  return (data ?? []).map((row) => mapAccountRow(row as DbAccountRow));
}

export async function getAccountByIdDirect(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, plan_tier, status, enabled_modules_json, limits_json, created_at")
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data ? mapAccountRow(data as DbAccountRow) : null;
}

export async function listFeatureFlagsByAccountIdDirect(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("id, account_id, flag_key, flag_value, description, rollout_notes, created_at")
    .eq("account_id", accountId)
    .order("flag_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load feature flags: ${error.message}`);
  }

  return (data ?? []).map((row) => mapFeatureFlagRow(row as DbFeatureFlagRow));
}

export async function listRecentErrorsByAccountIdDirect(input: {
  accountId: string;
  productArea?: string | null;
  limit?: number;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("error_events")
    .select("id, account_id, product_area, error_code, summary, occurred_at, created_at")
    .eq("account_id", input.accountId)
    .order("occurred_at", { ascending: false })
    .limit(input.limit ?? 5);

  if (input.productArea) {
    query = query.eq("product_area", input.productArea);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load recent errors: ${error.message}`);
  }

  return (data ?? []).map((row) => mapErrorEventRow(row as DbErrorEventRow));
}
