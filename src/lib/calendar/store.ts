import "server-only";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient, currentUser } from "../supabase/server";
import { isLocalMode, supabaseEnv } from "../supabase/env";
import type { Database } from "../db/types";
import type { Attribute } from "../game/types";
import { SignedOutError } from "../db/store";
import { storedEvent } from "./records";
import { LocalCalendarStore } from "./local";
import type { CalendarData, CalendarKind, CalendarStore, CalendarSyncChanges } from "./types";

type Client = SupabaseClient<Database>;
type Reply<T> = { data: T | null; error: { message: string; code?: string } | null };

function result<T>(response: Reply<T>): T {
  if (response.error) throw Object.assign(new Error(response.error.message), { code: response.error.code });
  if (response.data === null) throw new Error("Calendar data is unavailable.");
  return response.data;
}

function check(response: { error: { message: string } | null }) {
  if (response.error) throw new Error(response.error.message);
}

async function pages<T>(get: (start: number, end: number) => PromiseLike<Reply<T[]>>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let start = 0; ; start += size) {
    const batch = result(await get(start, start + size - 1));
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}

function admin(): Client {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Calendar sync requires a server-side Supabase service role key.");
  return createServiceClient<Database>(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

class SupabaseCalendarStore implements CalendarStore {
  constructor(private client: Client, private userId: string) {}

  async load(): Promise<CalendarData> {
    const [sources, events, rules, confirmations, profile, dismissedIds] = await Promise.all([
      pages((a,b) => this.client.from("calendar_sources").select("id,kind,label,last_synced_at").eq("user_id",this.userId).order("id").range(a,b)),
      pages((a,b) => this.client.from("calendar_events").select("id,source_id,external_id,title,starts_at,ends_at").eq("user_id",this.userId).order("id").range(a,b)),
      pages((a,b) => this.client.from("calendar_rules").select("id,match_text,quest_id,attr").eq("user_id",this.userId).order("id").range(a,b)),
      pages((a,b) => this.client.from("checkpoints").select("source_ref").eq("user_id",this.userId).eq("source","calendar").order("id").range(a,b)),
      this.client.from("profiles").select("waking_start,waking_end").eq("user_id",this.userId).single(),
      this.dismissedEventIds(),
    ]);
    const hours = result(profile);
    return {
      sources: sources.map(s => ({ id: s.id, kind: s.kind, name: s.label, lastSyncedAt: s.last_synced_at })),
      events: events.map(e => ({ id: e.id, sourceId: e.source_id, externalId: e.external_id, title: e.title, start: e.starts_at, end: e.ends_at })),
      rules: rules.map(r => ({ id: r.id, match: r.match_text, questId: r.quest_id, attribute: r.attr })),
      confirmedIds: confirmations.flatMap(c => c.source_ref ? [c.source_ref] : []),
      dismissedIds,
      wakingStart: hours.waking_start?.slice(0,5) ?? "07:00", wakingEnd: hours.waking_end?.slice(0,5) ?? "23:00",
    };
  }

  private async dismissedEventIds() {
    try {
      const rows = await pages((a, b) => this.client.from("calendar_dismissals").select("event_id")
        .eq("user_id", this.userId).order("event_id").range(a, b));
      return rows.map(({ event_id }) => event_id);
    } catch (error) {
      if (error instanceof Error && "code" in error && (error.code === "PGRST205" || error.code === "42P01")) return null;
      throw error;
    }
  }

  async addSource(kind: CalendarKind, name: string, secret: string) {
    return result(await admin().rpc("calendar_connect", { p_user: this.userId, p_kind: kind, p_name: name, p_secret: secret }));
  }

  async removeSource(id: string) {
    check(await this.client.from("calendar_sources").delete().eq("user_id", this.userId).eq("id", id));
  }

  async readSync(id: string) {
    const rows = result(await admin().rpc("calendar_sync_read", { p_user: this.userId, p_id: id }));
    const row = rows[0];
    if (!row) throw new Error("Calendar connection no longer exists.");
    const { kind, name, lastSyncedAt, secret, cursor_value: cursor, version, timezone } = row;
    return { source: { id, kind, name, lastSyncedAt }, secret, cursor, version, timezone };
  }

  async applySync(id: string, version: number, changes: CalendarSyncChanges) {
    const events = changes.events.map(event => {
      const stored = storedEvent(id, event);
      return { id: stored.id, externalId: event.externalId, title: event.title, start_time: event.start, end_time: event.end };
    });
    return result(await admin().rpc("calendar_sync_apply", {
      p_user: this.userId, p_id: id, p_version: version, p_events: events, p_deleted: changes.deleted ?? [],
      p_replace: changes.replace, p_cursor: changes.cursor ?? null,
    }));
  }

  async addRule(match: string, questId: string | null, attribute: Attribute | null) {
    check(await this.client.from("calendar_rules").insert({ user_id: this.userId, match_text: match.trim(), quest_id: questId, attr: attribute }));
  }

  async removeRule(id: string) {
    check(await this.client.from("calendar_rules").delete().eq("user_id", this.userId).eq("id", id));
  }

  async setWakingHours(start: string, end: string) {
    check(await this.client.from("profiles").update({ waking_start: start, waking_end: end }).eq("user_id",this.userId));
  }

  async confirmEvent(eventId: string, questId: string) {
    check(await this.client.rpc("calendar_confirm", { p_event: eventId, p_quest: questId }));
  }

  async dismissEvent(eventId: string) {
    check(await this.client.rpc("calendar_dismiss", { p_event: eventId }));
  }

  async clear() {
    const response = await this.client.rpc("calendar_clear");
    // A preview still awaiting the calendar migration has no connections to clear.
    if (response.error?.code !== "PGRST202") check(response);
  }
}

export async function calendarStore(): Promise<CalendarStore> {
  if (isLocalMode()) return new LocalCalendarStore();
  const user = await currentUser();
  if (!user) throw new SignedOutError();
  return new SupabaseCalendarStore(await createClient(), user.id);
}

// Called only after the cron route has authenticated the scheduler.
export async function listCalendarSyncJobs(): Promise<{ store: CalendarStore; sourceId: string }[]> {
  if (isLocalMode()) {
    const store = new LocalCalendarStore();
    return (await store.load()).sources.map(s => ({ store, sourceId: s.id }));
  }
  const service = admin();
  const rows = await pages((a,b) => service.from("calendar_sources").select("id,user_id")
    .order("last_synced_at", { nullsFirst: true }).order("id").range(a,b));
  return rows.map(row => ({ store: new SupabaseCalendarStore(service, row.user_id), sourceId: row.id }));
}
