import fs from "node:fs";
import { AUTH_DIR, dbClient, deleteTestUsers } from "./helpers";

/** Removes the throwaway users (their rows go with them) and the saved sessions. */
export default async function globalTeardown() {
  const db = dbClient();
  await db.connect();
  try {
    await deleteTestUsers(db);
  } finally {
    await db.end();
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
