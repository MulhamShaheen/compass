import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../db/types";
import { supabaseEnv } from "./env";

/** Supabase client for server components, server actions and route handlers. The session lives in cookies. */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server components cannot set cookies. src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user's id and email, read from the verified session token. Null when signed out. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
