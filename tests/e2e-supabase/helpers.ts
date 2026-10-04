import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import pg from "pg";

/**
 * Helpers for the Supabase e2e suite. It runs against the project in .env and
 * creates throwaway users named e2e-*@compass.test, which teardown removes.
 * Users are inserted straight into auth.users so no email is ever sent.
 */

export const PORT = 3126;
export const APP = `http://localhost:${PORT}`;
export const AUTH_DIR = path.join(process.cwd(), "test-results", ".auth");
export const USERS = { a: "e2e-a@compass.test", b: "e2e-b@compass.test", c: "e2e-c@compass.test" } as const;
export type UserKey = keyof typeof USERS;

export const env = () => {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
  if (!url || !key) throw new Error("Supabase e2e needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env");
  return { url, key };
};

export function dbClient(): pg.Client {
  const { SUPABASE_DB_URL, SUPABASE_PROJECT_REF: ref, SUPABASE_REGION: region, SUPABASE_PASSWORD: password } = process.env;
  const connectionString =
    SUPABASE_DB_URL ?? `postgresql://postgres.${ref}:${encodeURIComponent(password ?? "")}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  return new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

export async function deleteTestUsers(db: pg.Client): Promise<number> {
  const r = await db.query("delete from auth.users where email like 'e2e-%@compass.test'");
  return r.rowCount ?? 0;
}

export async function createUser(db: pg.Client, email: string, password: string): Promise<string> {
  const r = await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
       extensions.crypt($2, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
     returning id`,
    [email, password],
  );
  const id: string = r.rows[0].id;
  await db.query(
    `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::uuid, $2::text, jsonb_build_object('sub', $2::text, 'email', $3::text), 'email', now(), now(), now())`,
    [id, id, email],
  );
  return id;
}

/** Signs in with the password and returns the session cookies (as @supabase/ssr writes them) and the access token. */
export async function signIn(email: string, password: string) {
  const { url, key } = env();
  const jar = new Map<string, string>();
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("no session");
  return { cookies: [...jar].map(([name, value]) => ({ name, value })), token: data.session.access_token };
}

export interface SessionInfo {
  id: string;
  email: string;
  token: string;
}

export function storageStatePath(user: UserKey) {
  return path.join(AUTH_DIR, `${user}.json`);
}

export function readSessions(): Record<UserKey, SessionInfo> {
  return JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "sessions.json"), "utf8"));
}

/** Calls the Supabase REST API as a user, the way a hostile client could. */
export async function rest(path: string, token: string | null, init: RequestInit = {}) {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
}
