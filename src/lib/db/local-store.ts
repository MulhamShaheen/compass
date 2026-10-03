import "server-only";
import fs from "node:fs";
import path from "node:path";
import { emptyDb, type Db } from "./schema";

/**
 * Prototype persistence: one JSON file on the server for a single character.
 *
 * This stands in for Supabase until M0 is connected. Everything reads and
 * writes through `readDb` / `mutateDb`, so swapping it for typed Supabase
 * queries (with RLS on user_id) stays local to src/lib/db.
 */
const FILE = process.env.COMPASS_DATA_FILE ?? path.join(process.cwd(), ".data", "compass.json");

export function readDb(): Db {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<Db>;
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

export function writeDb(db: Db): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function mutateDb<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}
