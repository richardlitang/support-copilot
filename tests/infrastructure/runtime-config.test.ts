import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("does not treat an HTTP Supabase URL as a direct database URL", async () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_URL = "https://example.supabase.co";

    const { getRuntimeConfig, hasDirectDatabaseConfig } = await import("@/src/server/config/env");

    expect(getRuntimeConfig().databaseUrl).toBe("");
    expect(hasDirectDatabaseConfig()).toBe(false);
  });
});
