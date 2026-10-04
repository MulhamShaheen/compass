import fs from "node:fs";
import path from "node:path";
import { AUTH_DIR, createUser, dbClient, deleteTestUsers, signIn, storageStatePath, USERS, type SessionInfo, type UserKey } from "./helpers";

/** Creates the throwaway users and saves a signed-in browser state for each. */
export default async function globalSetup() {
  const password = `e2e-${crypto.randomUUID()}-Aa1!`;
  const db = dbClient();
  await db.connect();
  try {
    await deleteTestUsers(db);
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const sessions = {} as Record<UserKey, SessionInfo>;
    for (const key of Object.keys(USERS) as UserKey[]) {
      const email = USERS[key];
      const id = await createUser(db, email, password);
      const { cookies, token } = await signIn(email, password);
      sessions[key] = { id, email, token };
      const state = {
        cookies: cookies.map((c) => ({ ...c, domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const })),
        origins: [],
      };
      fs.writeFileSync(storageStatePath(key), JSON.stringify(state));
    }
    fs.writeFileSync(path.join(AUTH_DIR, "sessions.json"), JSON.stringify(sessions));
  } finally {
    await db.end();
  }
}
