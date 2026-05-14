import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { ensureEnvLoaded } from "../lib/env";

ensureEnvLoaded();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply migrations.");
}

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const client = new Client({ connectionString: databaseUrl });

async function ensureLocalSupabaseCompatibility() {
  await client.query("create schema if not exists extensions");

  for (const role of ["anon", "authenticated", "service_role"]) {
    await client.query(`
      do $$
      begin
        if not exists (select from pg_roles where rolname = '${role}') then
          create role ${role};
        end if;
      end
      $$;
    `);
  }
}

async function main() {
  await client.connect();
  await ensureLocalSupabaseCompatibility();

  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default timezone('utc', now())
    )
  `);

  const applied = new Set(
    (await client.query<{ filename: string }>("select filename from schema_migrations")).rows.map((row) => row.filename)
  );
  const files = (await readdir(migrationsDir)).filter((filename) => filename.endsWith(".sql")).sort();

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    console.log(`Applying ${filename}`);
    await client.query("begin");

    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

main()
  .then(async () => {
    await client.end();
  })
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
