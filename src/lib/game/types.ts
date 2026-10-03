export const ATTRIBUTES = ["body", "mind", "bonds", "craft", "spirit"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  body: "Body",
  mind: "Mind",
  bonds: "Bonds",
  craft: "Craft",
  spirit: "Spirit",
};

export const ATTRIBUTE_HINTS: Record<Attribute, string> = {
  body: "Sleep, movement, health. The vehicle for everything else.",
  mind: "Learning, focus and curiosity.",
  bonds: "Family, friends, love. The people you keep close.",
  craft: "Work and making things. Skills you are growing.",
  spirit: "Calm, meaning and play. What makes it worth it.",
};

export type QuestType = "main" | "side" | "system";
export type QuestStatus = "active" | "paused" | "done";

/** The fields of a quest that game rules depend on. */
export interface GameQuest {
  id: string;
  type: QuestType;
  status: QuestStatus;
  primaryAttr: Attribute;
  secondaryAttr: Attribute | null;
}

/** The fields of a checkpoint that game rules depend on. */
export interface GameCheckpoint {
  questId: string;
  /** ISO timestamp (UTC). */
  occurredAt: string;
  minutes: number;
  isMilestone: boolean;
}

export const WEATHERS = ["clear", "breezy", "cloudy", "foggy", "stormy"] as const;
export type Weather = (typeof WEATHERS)[number];

export const WEATHER_NAMES: Record<Weather, string> = {
  clear: "Clear",
  breezy: "Breezy",
  cloudy: "Cloudy",
  foggy: "Foggy",
  stormy: "Stormy",
};

export type HabitKind = "keep" | "starve";
