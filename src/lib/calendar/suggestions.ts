import type { Quest } from "../db/schema";
import type { CalendarEvent, CalendarRule } from "./types";

export type CalendarQuest = Pick<Quest, "id" | "title" | "type" | "status" | "primaryAttr" | "secondaryAttr">;

function questMatches(event: Pick<CalendarEvent, "title">, rules: readonly CalendarRule[], quests: readonly CalendarQuest[]) {
  const title = event.title.toLowerCase();
  const matching = rules.filter((rule) => title.includes(rule.match.toLowerCase()));
  return quests.filter((quest) => quest.type !== "system" && quest.status === "active").flatMap((quest) => {
    const rules = matching.filter((rule) =>
      rule.questId === quest.id || (rule.attribute && (rule.attribute === quest.primaryAttr || rule.attribute === quest.secondaryAttr))
    );
    return rules.length ? [{ quest, rules }] : [];
  });
}

export function matchingQuests(event: Pick<CalendarEvent, "title">, rules: readonly CalendarRule[], quests: readonly CalendarQuest[]) {
  return questMatches(event, rules, quests).map(({ quest }) => quest);
}

/** Rule previews and saved suggestions use the same eligibility and sort order. */
export function suggestedCheckpoints(
  events: readonly CalendarEvent[], rules: readonly CalendarRule[], quests: readonly CalendarQuest[],
  now: Date, hidden: ReadonlySet<string>,
) {
  const cutoff = now.getTime();
  return events
    .filter((event) => !hidden.has(event.id) && Date.parse(event.end) <= cutoff)
    .flatMap((event) => {
      const matches = questMatches(event, rules, quests);
      return matches.length ? [{ event, matches }] : [];
    })
    .sort((a, b) => Date.parse(b.event.start) - Date.parse(a.event.start) || a.event.id.localeCompare(b.event.id));
}
