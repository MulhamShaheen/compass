import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const baselineUrl = new URL("./calendar-schema-baselines.json", import.meta.url);
const catalogUrl = new URL("./calendar-schema.sql", import.meta.url);
const versions = ["20261123000000", "20261124000000"];

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function repairCalendarHistory(client, dir) {
  const baseline = JSON.parse(readFileSync(baselineUrl, "utf8"));
  await client.query("begin");
  try {
    await client.query("lock table supabase_migrations.schema_migrations in exclusive mode");
    await client.query("set local search_path = pg_catalog");
    const { rows: installed } = await client.query(
      "select exists(select 1 from pg_extension where extname = 'supabase_vault') as vault",
    );
    if (!installed[0].vault) throw new Error("Supabase Vault is missing. Calendar migration history was not changed.");
    const { rows } = await client.query(readFileSync(catalogUrl, "utf8"));
    const actual = Object.fromEntries(rows.map((row) => [row.object, digest(row.definition)]));
    const differences = (expected) => [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
      .filter((object) => expected[object] !== actual[object]);
    const comparisons = versions.map((version) => ({ version, changes: differences(baseline[version]) }));
    const match = comparisons.find(({ changes }) => changes.length === 0);
    if (!match) {
      const closest = comparisons.sort((a, b) => a.changes.length - b.changes.length)[0];
      throw new Error(`Calendar schema does not match the migration. History was not changed. Check: ${closest.changes.join(", ")}`);
    }
    const files = readdirSync(dir);
    const repaired = [];
    for (const version of versions.filter((value) => value <= match.version)) {
      const file = files.find((name) => name.startsWith(version + "_") && name.endsWith(".sql"));
      if (!file) throw new Error(`Missing local migration ${version}.`);
      const sql = readFileSync(path.join(dir, file), "utf8");
      const result = await client.query(
        "insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3) on conflict (version) do nothing",
        [version, [sql], file.slice(15, -4)],
      );
      if (result.rowCount) repaired.push(file);
    }
    await client.query("commit");
    for (const file of repaired) console.log(`recorded  ${file}`);
    if (!repaired.length) console.log("Calendar migrations are already recorded.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
