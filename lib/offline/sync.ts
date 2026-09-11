import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/browser";
import { getLocalDatabase, type PendingMutation } from "./db";

function toTaskRow(payload: Record<string, unknown>) {
  return {
    id: payload.id as string,
    user_id: payload.userId as string,
    name: payload.name as string,
    color: payload.color as string,
    goal_kind: payload.goalKind as "minimum" | "limit",
    target_seconds: payload.targetSeconds as number,
    sort_order: payload.sortOrder as number,
    archived_at: (payload.archivedAt as string | null) ?? null,
  };
}

function toEntryRow(payload: Record<string, unknown>) {
  return {
    id: payload.id as string,
    user_id: payload.userId as string,
    task_id: payload.taskId as string,
    local_date: payload.localDate as string,
    duration_seconds: payload.durationSeconds as number,
    source: payload.source as "timer" | "manual" | "recovered",
    started_at: (payload.startedAt as string | null) ?? null,
    ended_at: (payload.endedAt as string | null) ?? null,
    manually_adjusted: Boolean(payload.manuallyAdjusted),
    mutation_id: payload.mutationId as string,
  };
}

async function applyMutation(
  client: SupabaseClient<Database>,
  mutation: PendingMutation,
) {
  const payload = mutation.payload;
  switch (mutation.kind) {
    case "task-upsert":
      return client.from("tasks").upsert(toTaskRow(payload));
    case "task-archive":
      return client
        .from("tasks")
        .update({ archived_at: payload.archivedAt as string })
        .eq("id", payload.id as string);
    case "timer-start":
      return client.from("active_timers").upsert({
        id: payload.id as string,
        user_id: payload.userId as string,
        task_id: payload.taskId as string,
        started_at: payload.startedAt as string,
        timezone: payload.timezone as string,
        accumulated_seconds: payload.accumulatedSeconds as number,
        checkpointed_at: payload.checkpointedAt as string,
        checkpoint_seconds: payload.checkpointSeconds as number,
        limit_override: Boolean(payload.limitOverride),
        mutation_id: payload.mutationId as string,
      });
    case "timer-stop": {
      const entries = payload.entries as Record<string, unknown>[];
      if (entries.length > 0) {
        const inserted = await client
          .from("time_entries")
          .upsert(entries.map(toEntryRow));
        if (inserted.error) return inserted;
      }
      return client
        .from("active_timers")
        .delete()
        .eq("id", payload.timerId as string);
    }
    case "entry-upsert":
      return client.from("time_entries").upsert(toEntryRow(payload));
    case "entry-delete":
      return client
        .from("time_entries")
        .delete()
        .eq("id", payload.id as string);
    case "profile-update":
      return client
        .from("profiles")
        .update({
          display_name: payload.displayName as string,
          timezone: payload.timezone as string,
          theme: payload.theme as "system" | "light" | "dark",
          onboarding_completed: Boolean(payload.onboardingCompleted),
        })
        .eq("id", payload.id as string);
    case "goal-upsert":
      return client.from("daily_goal_changes").upsert(
        {
          id: payload.id as string,
          user_id: payload.userId as string,
          effective_date: payload.effectiveDate as string,
          goal_seconds: payload.goalSeconds as number,
        },
        { onConflict: "user_id,effective_date" },
      );
  }
}

export async function syncPendingMutations(
  userId: string,
): Promise<{ synced: number; error?: string }> {
  const db = getLocalDatabase();
  if (!db || !navigator.onLine) return { synced: 0 };
  const client = createClient();
  const pending = await db.pendingMutations
    .where("userId")
    .equals(userId)
    .sortBy("createdAt");
  let synced = 0;

  for (const mutation of pending) {
    const result = await applyMutation(client, mutation);
    if (result.error) return { synced, error: result.error.message };
    await db.pendingMutations.delete(mutation.id);
    synced += 1;
  }
  return { synced };
}
