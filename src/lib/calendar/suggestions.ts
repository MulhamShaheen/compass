import type { Quest } from "../db/schema";
import type { CalendarEvent, CalendarRule } from "./types";

export type CalendarQuest = Pick<Quest, "id" | "title" | "type" | "status" | "primaryAttr" | "secondaryAttr">;

/** One event can match several rules. Offer each eligible quest only once. */
export function matchingQuests(event: Pick<CalendarEvent, "title">, rules: CalendarRule[], quests: CalendarQuest[]) {
  const title = event.title.toLowerCase();
  const matching = rules.filter((rule) => title.includes(rule.match.toLowerCase()));
  return quests.filter((quest) => quest.type !== "system" && quest.status === "active" && matching.some((rule) =>
    rule.questId === quest.id || (rule.attribute && (rule.attribute === quest.primaryAttr || rule.attribute === quest.secondaryAttr))
  ));
}
