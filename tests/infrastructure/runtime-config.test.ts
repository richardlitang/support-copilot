import { afterEach, describe, expect, it, vi } from "vitest";

// Keep these tests hermetic: the env module reads .env.local / .env on first
// access, which would otherwise inject the developer's real DATABASE_URL and
// mask the process.env scenarios under test. Stub the file reads to no-ops so
// process.env is the only source of truth here.
vi.mock("node:fs", () => ({
  existsSync: () => false,
  readFileSync: () => "",
}));

const originalEnv = { ...process.env };

describe("runtime config", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("uses a Postgres SUPABASE_URL as the direct database URL when DATABASE_URL is absent", async () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL = "postgresql://postgres:secret@db.example.supabase.co:5432/postgres";

    const { getRuntimeConfig, hasDirectDatabaseConfig } = await import("@/src/server/config/env");

    expect(getRuntimeConfig().databaseUrl).toBe(
      "postgresql://postgres:secret@db.example.supabase.co:5432/postgres",
    );
    expect(hasDirectDatabaseConfig()).toBe(true);
  });

  it("strips surrounding quotes from a Postgres SUPABASE_URL injected externally", async () => {
    // kubectl `create secret --from-env-file` preserves the literal quotes
    // around values in .env.local, so the pod sees a leading/trailing `"`.
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL =
      '"postgresql://postgres:secret@db.example.supabase.co:5432/postgres"';
    // (DATABASE_URL deleted above so the SUPABASE_URL fallback is exercised.)

    const { getRuntimeConfig, hasDirectDatabaseConfig } = await import("@/src/server/config/env");

    expect(getRuntimeConfig().databaseUrl).toBe(
      "postgresql://postgres:secret@db.example.supabase.co:5432/postgres",
    );
    expect(hasDirectDatabaseConfig()).toBe(true);
  });

  it("strips surrounding quotes from an externally-injected DATABASE_URL", async () => {
    process.env.DATABASE_URL =
      '"postgresql://postgres.ref:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"';

    const { getRuntimeConfig } = await import("@/src/server/config/env");

    expect(getRuntimeConfig().databaseUrl).toBe(
      "postgresql://postgres.ref:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("does not treat an HTTP Supabase URL as a direct database URL", async () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL = "https://example.supabase.co";

    const { getRuntimeConfig, hasDirectDatabaseConfig } = await import("@/src/server/config/env");

    expect(getRuntimeConfig().databaseUrl).toBe("");
    expect(hasDirectDatabaseConfig()).toBe(false);
  });
});
