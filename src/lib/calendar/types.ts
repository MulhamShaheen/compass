import type { Attribute } from "../game/types";

export type CalendarKind = "ics" | "google";
export interface CalendarSource {
  id: string;
  kind: CalendarKind;
  name: string;
  lastSyncedAt: string | null;
}

export interface CalendarInputEvent {
  externalId: string;
  title: string;
  start: string;
  end: string;
}

export interface CalendarEvent extends CalendarInputEvent {
  id: string;
  sourceId: string;
}

export interface CalendarRule {
  id: string;
  match: string;
  questId: string | null;
  attribute: Attribute | null;
}

export interface CalendarData {
  sources: CalendarSource[];
  events: CalendarEvent[];
  rules: CalendarRule[];
  confirmedIds: string[];
  /** Null when the deployment is still waiting for the dismissal migration. */
  dismissedIds: string[] | null;
  wakingStart: string;
  wakingEnd: string;
}

export interface CalendarSyncState {
  source: CalendarSource;
  secret: string;
  cursor: string | null;
  version: number;
  timezone: string;
}

export interface CalendarSyncChanges {
  events: CalendarInputEvent[];
  deleted?: string[];
  replace: boolean;
  cursor?: string | null;
}

export interface CalendarStore {
  load(): Promise<CalendarData>;
  addSource(kind: CalendarKind, name: string, secret: string): Promise<string>;
  removeSource(id: string): Promise<void>;
  addRule(match: string, questId: string | null, attribute: Attribute | null): Promise<void>;
  removeRule(id: string): Promise<void>;
  setWakingHours(start: string, end: string): Promise<void>;
  confirmEvent(eventId: string, questId: string): Promise<void>;
  dismissEvent(eventId: string): Promise<void>;
  readSync(id: string): Promise<CalendarSyncState>;
  applySync(id: string, version: number, changes: CalendarSyncChanges): Promise<boolean>;
  clear(): Promise<void>;
}
