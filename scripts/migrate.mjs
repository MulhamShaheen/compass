/**
 * Applies supabase/migrations/*.sql to the Supabase database, in order, once each.
 *
 * Usage: npm run db:migrate            (applies pending migrations)
 *        npm run db:migrate -- --status (lists applied and pending)
 *
 * Connection: SUPABASE_DB_URL if set, otherwise the IPv4 session pooler built from
 * SUPABASE_PROJECT_REF, SUPABASE_REGION and SUPABASE_PASSWORD (all read from .env).
 * Applied versions are recorded in supabase_migrations.schema_migrations, the same
 * table the Supabase CLI uses, so `supabase db push` can take over later.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const dir = path.join(process.cwd(), "supabase", "migrations");
const statusOnly = process.argv.includes("--status");

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const { SUPABASE_PROJECT_REF: ref, SUPABASE_REGION: region, SUPABASE_PASSWORD: password } = process.env;
  if (!ref || !region || !password) {
    throw new Error("Set SUPABASE_DB_URL, or SUPABASE_PROJECT_REF, SUPABASE_REGION and SUPABASE_PASSWORD in .env");
  }
  const host = process.env.SUPABASE_POOLER_HOST ?? `aws-0-${region}.pooler.supabase.com`;
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`;
}

const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );
  `);
  const applied = new Set((await client.query("select version from supabase_migrations.schema_migrations")).rows.map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    const [, version, name] = file.match(/^(\d+)_(.+)\.sql$/);
    if (applied.has(version)) {
      console.log(`applied   ${file}`);
      continue;
    }
    if (statusOnly) {
      console.log(`pending   ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)", [version, [sql], name]);
      await client.query("commit");
      console.log(`applying  ${file} ... ok`);
    } catch (e) {
      await client.query("rollback");
      console.error(`applying  ${file} ... failed`);
      throw e;
    }
  }
} finally {
  await client.end();
}
