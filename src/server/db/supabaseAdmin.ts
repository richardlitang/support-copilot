import { createClient } from "@supabase/supabase-js";
import { ensureEnvLoaded } from "@/src/server/config/env";

function getSupabaseUrl() {
  ensureEnvLoaded();
  const rawUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /^"(.*)"$/,
    "$1",
  );

  if (!rawUrl) {
    return "";
  }

  if (rawUrl.startsWith("postgresql://") || rawUrl.startsWith("postgres://")) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname;
      const projectRef = host.startsWith("db.") ? host.slice(3).split(".")[0] : "";

      if (projectRef) {
        return `https://${projectRef}.supabase.co`;
      }
    } catch {
      return "";
    }
  }

  return rawUrl;
}

function getSupabaseServiceKey() {
  ensureEnvLoaded();
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function hasDatabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

function buildSupabaseAdminClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type SupabaseAdminClient = ReturnType<typeof buildSupabaseAdminClient>;

let supabaseAdminClient: SupabaseAdminClient | null = null;

export function getSupabaseAdminClient(): SupabaseAdminClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  supabaseAdminClient = buildSupabaseAdminClient(url, key);
  return supabaseAdminClient;
}
