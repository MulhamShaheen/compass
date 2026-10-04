/**
 * Supabase database types, written by hand to match supabase/migrations until the
 * Supabase CLI is installed; then `npm run db:types` replaces this file.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AttributeEnum = "body" | "mind" | "bonds" | "craft" | "spirit";

/** Insert = Row with defaulted columns optional. */
type Table<Row, Defaulted extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, Defaulted> & Partial<Pick<Row, Defaulted>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          user_id: string;
          character_name: string | null;
          true_north: string | null;
          timezone: string;
          waking_start: string | null;
          waking_end: string | null;
          quiet_mode: boolean;
          prologue_completed_at: string | null;
          created_at: string;
          dev_day_offset: number;
        },
        "character_name" | "true_north" | "timezone" | "waking_start" | "waking_end" | "quiet_mode" | "prologue_completed_at" | "created_at" | "dev_day_offset"
      >;
      prototype_state: Table<{ user_id: string; doc: Json; updated_at: string }, "user_id" | "updated_at">;
      chapters: Table<
        { id: string; user_id: string; title: string; started_on: string; ended_on: string | null; summary: string | null },
        "id" | "user_id" | "started_on" | "ended_on" | "summary"
      >;
      attribute_ratings: Table<
        { id: string; user_id: string; attribute: AttributeEnum; rating: number; context: "baseline" | "weekly_review"; rated_at: string },
        "id" | "user_id" | "context" | "rated_at"
      >;
      quests: Table<
        {
          id: string;
          user_id: string;
          chapter_id: string | null;
          type: "main" | "side" | "system";
          status: "active" | "paused" | "done";
          title: string;
          why: string | null;
          primary_attr: AttributeEnum;
          secondary_attr: AttributeEnum | null;
          started_on: string;
          completed_at: string | null;
          created_at: string;
        },
        "id" | "user_id" | "chapter_id" | "status" | "why" | "secondary_attr" | "started_on" | "completed_at" | "created_at"
      >;
      checkpoints: Table<
        {
          id: string;
          user_id: string;
          quest_id: string;
          occurred_at: string;
          title: string;
          note: string | null;
          minutes: number;
          is_milestone: boolean;
          source: "manual" | "calendar" | "system";
          source_ref: string | null;
          created_at: string;
        },
        "id" | "user_id" | "note" | "minutes" | "is_milestone" | "source" | "source_ref" | "created_at"
      >;
      habits: Table<
        { id: string; user_id: string; name: string; kind: "keep" | "starve"; archived_at: string | null; created_at: string },
        "id" | "user_id" | "archived_at" | "created_at"
      >;
      habit_logs: Table<{ habit_id: string; user_id: string; day: string }, "user_id">;
      weather_logs: Table<{ user_id: string; day: string; weather: string }, "user_id">;
      journal_entries: Table<
        { id: string; user_id: string; day: string; prompt: string | null; body: string; weather: string | null; created_at: string },
        "id" | "user_id" | "prompt" | "weather" | "created_at"
      >;
      prompts: Table<{ id: string; user_id: string | null; text: string; sort: number; active: boolean }, "id" | "user_id" | "sort" | "active">;
      unlocks: Table<{ user_id: string; feature: string; unlocked_at: string; seen_at: string | null }, "user_id" | "unlocked_at" | "seen_at">;
      weekly_reviews: Table<
        { id: string; user_id: string; week_start: string; note: string | null; completed_at: string },
        "id" | "user_id" | "note" | "completed_at"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      attribute: AttributeEnum;
      quest_type: "main" | "side" | "system";
      quest_status: "active" | "paused" | "done";
    };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
