import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readDb, writeDb } from "../db/local-store";
import { matchingQuests } from "./suggestions";
import { storedEvent } from "./records";
import type { Attribute } from "../game/types";
import type { CalendarData, CalendarKind, CalendarRule, CalendarSource, CalendarStore, CalendarSyncChanges } from "./types";

interface PrivateSource extends CalendarSource {
  secret: string;
  cursor: string | null;
  version: number;
}

interface LocalData extends Omit<CalendarData, "sources" | "confirmedIds" | "dismissedIds"> {
  sources: PrivateSource[];
  dismissals?: Record<string, string>;
}

function publicSource({ id, name, kind, lastSyncedAt }: CalendarSource): CalendarSource {
  return { id, name, kind, lastSyncedAt };
}

// Local mode has a single character in one Node process. Keep sync credentials
// in a separate owner-readable file, outside the character data and JSON export.
export class LocalCalendarStore implements CalendarStore {
  private readonly file = (process.env.COMPASS_DATA_FILE ?? path.join(process.cwd(), ".data", "compass.json")) + ".calendar.json";

  private read(): LocalData {
    try {
      return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ this.file, "utf8")) as LocalData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { sources: [], rules: [], events: [], wakingStart: "07:00", wakingEnd: "23:00" };
    }
  }

  private write(data: LocalData) {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(this.file), { recursive: true });
    const temp = this.file + "." + randomUUID() + ".tmp";
    try {
      fs.writeFileSync(/*turbopackIgnore: true*/ temp, JSON.stringify(data), { mode: 0o600, flag: "wx" });
      fs.renameSync(/*turbopackIgnore: true*/ temp, /*turbopackIgnore: true*/ this.file);
    } finally {
      fs.rmSync(/*turbopackIgnore: true*/ temp, { force: true });
    }
  }

  async load(): Promise<CalendarData> {
    const { dismissals, ...data } = this.read();
    const confirmedIds = readDb().checkpoints.flatMap(c => c.source === "calendar" && c.sourceRef ? [c.sourceRef] : []);
    return { ...data, sources: data.sources.map(publicSource), confirmedIds, dismissedIds: Object.keys(dismissals ?? {}) };
  }

  async addSource(kind: CalendarKind, name: string, secret: string): Promise<string> {
    const data = this.read();
    const existing = data.sources.find(s => s.kind === kind && (kind === "google" || s.secret === secret));
    if (existing) {
      if (kind === "google") {
        Object.assign(existing, { name, secret, cursor: null, lastSyncedAt: null, version: existing.version + 1 });
        data.events = data.events.filter(e => e.sourceId !== existing.id);
        this.write(data);
      }
      return existing.id;
    }
    const id = randomUUID();
    data.sources.push({ id, name, kind, secret, version: 0, cursor: null, lastSyncedAt: null });
    this.write(data);
    return id;
  }

  async removeSource(id: string) {
    const data = this.read();
    data.sources = data.sources.filter(s => s.id !== id);
    data.events = data.events.filter(e => e.sourceId !== id);
    if (data.dismissals) {
      data.dismissals = Object.fromEntries(Object.entries(data.dismissals).filter(([, sourceId]) => sourceId !== id));
    }
    this.write(data);
  }

  async readSync(id: string) {
    const source = this.read().sources.find(s => s.id === id);
    if (!source) throw new Error("Calendar connection no longer exists.");
    return { source: publicSource(source), secret: source.secret, cursor: source.cursor,
      version: source.version, timezone: readDb().profile?.timezone ?? "UTC" };
  }

  async applySync(id: string, version: number, changes: CalendarSyncChanges) {
    const data = this.read();
    const source = data.sources.find(s => s.id === id);
    if (!source || source.version !== version) return false;
    const removed = new Set(changes.deleted);
    const incoming = changes.events.map(e => storedEvent(id, e));
    for (const e of incoming) removed.add(e.externalId);
    data.events = data.events.filter(e => e.sourceId !== id || (!changes.replace && !removed.has(e.externalId)));
    data.events.push(...incoming);
    source.version++;
    source.lastSyncedAt = new Date().toISOString();
    source.cursor = changes.cursor ?? null;
    this.write(data);
    return true;
  }

  async addRule(match: string, questId: string | null, attribute: Attribute | null) {
    const data = this.read();
    if (!match.trim() || (questId === null) === (attribute === null) ||
        (questId && !readDb().quests.some(q => q.id === questId))) throw new Error("Choose a rule target and a title to match.");
    const rule: CalendarRule = { id: randomUUID(), match: match.trim(), questId, attribute };
    data.rules.push(rule);
    this.write(data);
  }

  async removeRule(id: string) {
    const data = this.read();
    data.rules = data.rules.filter(r => r.id !== id);
    this.write(data);
  }

  async setWakingHours(start: string, end: string) {
    this.write({ ...this.read(), wakingStart: start, wakingEnd: end });
  }

  async confirmEvent(eventId: string, questId: string) {
    const db = readDb();
    if (db.checkpoints.some(cp => cp.source === "calendar" && cp.sourceRef === eventId)) return;
    const { events, rules, dismissals } = this.read();
    const event = events.find(e => e.id === eventId);
    if (!event || Object.hasOwn(dismissals ?? {}, eventId) || Date.parse(event.end) > Date.now() ||
        !matchingQuests(event, rules, db.quests).some(q => q.id === questId)) {
      throw new Error("This event is no longer available for that quest.");
    }
    const minutes = Math.min(1440, Math.max(0, Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60000)));
    db.checkpoints.push({ id: randomUUID(), questId, title: event.title.slice(0, 160), occurredAt: event.start,
      minutes, note: null, source: "calendar", sourceRef: eventId, isMilestone: false, createdAt: new Date().toISOString() });
    writeDb(db);
  }

  async dismissEvent(eventId: string) {
    const data = this.read();
    if (Object.hasOwn(data.dismissals ?? {}, eventId) ||
        readDb().checkpoints.some(cp => cp.source === "calendar" && cp.sourceRef === eventId)) return;
    const event = data.events.find(e => e.id === eventId);
    if (!event || Date.parse(event.end) > Date.now()) throw new Error("This event is no longer available.");
    data.dismissals = { ...data.dismissals, [eventId]: event.sourceId };
    this.write(data);
  }

  async clear() {
    fs.rmSync(/*turbopackIgnore: true*/ this.file, { force: true });
  }
}
