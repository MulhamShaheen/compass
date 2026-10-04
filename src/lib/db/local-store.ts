import "server-only";
import fs from "node:fs";
import path from "node:path";
import { emptyDb, type Db } from "./schema";

/**
 * Prototype persistence: one JSON file on the server for a single character.
 *
 * Used only with COMPASS_STORE=local (the Playwright tests). Everything else goes
 * through src/lib/db/store.ts, which picks this or Supabase.
 */
const FILE = process.env.COMPASS_DATA_FILE ?? path.join(process.cwd(), ".data", "compass.json");

export function readDb(): Db {
  try {
    const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ FILE, "utf8")) as Partial<Db>;
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

export function writeDb(db: Db): void {
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(/*turbopackIgnore: true*/ tmp, JSON.stringify(db, null, 2));
  fs.renameSync(/*turbopackIgnore: true*/ tmp, FILE);
}
