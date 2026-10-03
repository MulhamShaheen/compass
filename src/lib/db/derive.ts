import {
  attributeTotals,
  characterLevel,
  evaluateUnlocks,
  totalPoints,
  UNLOCK_COPY,
  type Feature,
  type UnlockState,
} from "../game";
import { dayKey } from "../time";
import type { Db, Quest } from "./schema";

const DAY_MS = 86_400_000;

/** The app clock. In the prototype it can be shifted by whole days to simulate the first week. */
export function appNow(db: Db): Date {
  return new Date(Date.now() + db.dev.dayOffset * DAY_MS);
}

export function timezone(db: Db): string {
  return db.profile?.timezone ?? "UTC";
}

export function prologueQuest(db: Db): Quest | undefined {
  return db.quests.find((q) => q.type === "system");
}

export function playableCheckpoints(db: Db) {
  const playable = new Set(db.quests.filter((q) => q.type !== "system").map((q) => q.id));
  return db.checkpoints.filter((c) => playable.has(c.questId));
}

export function currentLevel(db: Db): number {
  return characterLevel(totalPoints(attributeTotals(db.quests, db.checkpoints))).level;
}

export function unlockState(db: Db, now: Date): UnlockState {
  const tz = timezone(db);
  const cps = playableCheckpoints(db);
  const start = db.profile?.prologueCompletedAt ? new Date(db.profile.prologueCompletedAt) : now;
  return {
    startDay: dayKey(start, tz),
    today: dayKey(now, tz),
    checkinDays: new Set(db.weather.map((w) => w.day)).size,
    checkpoints: cps.length,
    questsWithCheckpoints: new Set(cps.map((c) => c.questId)).size,
    totalPoints: totalPoints(attributeTotals(db.quests, db.checkpoints)),
    journalEntries: db.journal.length,
    weeklyReviews: db.reviews.length,
  };
}

export function isUnlocked(db: Db, feature: Feature): boolean {
  return db.unlocks.some((u) => u.feature === feature);
}

/**
 * Runs after every action: records newly met unlocks and writes each one as a
 * checkpoint in the Prologue quest, so the start of the story can be read back.
 */
export function syncUnlocks(db: Db, now: Date): Feature[] {
  if (!db.profile?.prologueCompletedAt) return [];
  const met = evaluateUnlocks(unlockState(db, now));
  const fresh = met.filter((f) => !isUnlocked(db, f));
  const prologue = prologueQuest(db);
  for (const feature of fresh) {
    const at = now.toISOString();
    db.unlocks.push({ feature, unlockedAt: at, seenAt: null });
    if (prologue) {
      db.checkpoints.push({
        id: crypto.randomUUID(),
        questId: prologue.id,
        occurredAt: at,
        title: `Unlocked: ${UNLOCK_COPY[feature].title}`,
        note: UNLOCK_COPY[feature].body,
        minutes: 0,
        isMilestone: false,
        source: "system",
        createdAt: at,
      });
    }
  }
  return fresh;
}
