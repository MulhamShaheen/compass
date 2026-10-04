/**
 * Supabase database types, written by hand to match supabase/migrations until the
 * Supabase CLI is installed; then `npm run db:types` replaces this file.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          character_name: string | null;
          true_north: string | null;
          timezone: string;
          waking_start: string | null;
          waking_end: string | null;
          quiet_mode: boolean;
          prologue_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          character_name?: string | null;
          true_north?: string | null;
          timezone?: string;
          waking_start?: string | null;
          waking_end?: string | null;
          quiet_mode?: boolean;
          prologue_completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      prototype_state: {
        Row: { user_id: string; doc: Json; updated_at: string };
        Insert: { user_id?: string; doc: Json; updated_at?: string };
        Update: { user_id?: string; doc?: Json; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
