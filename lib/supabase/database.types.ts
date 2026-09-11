export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          timezone: string;
          theme: "system" | "light" | "dark";
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          timezone?: string;
          theme?: "system" | "light" | "dark";
          onboarding_completed?: boolean;
        };
        Update: {
          display_name?: string;
          timezone?: string;
          theme?: "system" | "light" | "dark";
          onboarding_completed?: boolean;
        };
        Relationships: [];
      };
      daily_goal_changes: {
        Row: {
          id: string;
          user_id: string;
          effective_date: string;
          goal_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          effective_date: string;
          goal_seconds: number;
        };
        Update: { effective_date?: string; goal_seconds?: number };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          goal_kind: "minimum" | "limit";
          target_seconds: number;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          goal_kind: "minimum" | "limit";
          target_seconds: number;
          sort_order: number;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          color?: string;
          goal_kind?: "minimum" | "limit";
          target_seconds?: number;
          sort_order?: number;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      active_timers: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          started_at: string;
          timezone: string;
          accumulated_seconds: number;
          checkpointed_at: string;
          checkpoint_seconds: number;
          limit_override: boolean;
          mutation_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          started_at: string;
          timezone: string;
          accumulated_seconds?: number;
          checkpointed_at: string;
          checkpoint_seconds?: number;
          limit_override?: boolean;
          mutation_id: string;
        };
        Update: {
          checkpointed_at?: string;
          checkpoint_seconds?: number;
          limit_override?: boolean;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          local_date: string;
          duration_seconds: number;
          source: "timer" | "manual" | "recovered";
          started_at: string | null;
          ended_at: string | null;
          manually_adjusted: boolean;
          mutation_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          local_date: string;
          duration_seconds: number;
          source: "timer" | "manual" | "recovered";
          started_at?: string | null;
          ended_at?: string | null;
          manually_adjusted?: boolean;
          mutation_id: string;
        };
        Update: {
          task_id?: string;
          local_date?: string;
          duration_seconds?: number;
          manually_adjusted?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      daily_summaries: {
        Row: {
          user_id: string | null;
          local_date: string | null;
          tracked_seconds: number | null;
          entry_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      profile_theme: "system" | "light" | "dark";
      goal_kind: "minimum" | "limit";
      entry_source: "timer" | "manual" | "recovered";
    };
    CompositeTypes: Record<string, never>;
  };
}
