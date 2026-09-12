import Dexie, { type EntityTable } from "dexie";
import type {
  ActiveTimer,
  DailyGoalChange,
  Profile,
  Task,
  TimeEntry,
} from "@/lib/domain/types";

export interface PendingMutation {
  id: string;
  userId: string;
  kind:
    | "task-upsert"
    | "task-archive"
    | "task-list-state"
    | "timer-start"
    | "timer-stop"
    | "entry-upsert"
    | "entry-delete"
    | "profile-update"
    | "goal-upsert";
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LocalProfile extends Profile {
  accountStart: string;
}

export class TimeEightDatabase extends Dexie {
  profiles!: EntityTable<LocalProfile, "id">;
  dailyGoals!: EntityTable<DailyGoalChange, "id">;
  tasks!: EntityTable<Task, "id">;
  activeTimers!: EntityTable<ActiveTimer, "id">;
  timeEntries!: EntityTable<TimeEntry, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;

  constructor() {
    super("timeeight");
    this.version(1).stores({
      profiles: "&id",
      dailyGoals: "&id, userId, effectiveDate",
      tasks: "&id, userId, [userId+sortOrder], archivedAt",
      activeTimers: "&id, userId, [userId+taskId]",
      timeEntries: "&id, userId, [userId+localDate], taskId, mutationId",
      pendingMutations: "&id, userId, createdAt",
    });
    this.version(2)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table("tasks")
          .toCollection()
          .modify((task) => {
            task.onDailyList = !task.archivedAt;
          });
      });
  }
}

let database: TimeEightDatabase | undefined;

export function getLocalDatabase(): TimeEightDatabase | null {
  if (typeof indexedDB === "undefined") return null;
  database ??= new TimeEightDatabase();
  return database;
}

export async function clearLocalUser(userId: string): Promise<void> {
  const db = getLocalDatabase();
  if (!db) return;
  await db.transaction(
    "rw",
    [
      db.profiles,
      db.dailyGoals,
      db.tasks,
      db.activeTimers,
      db.timeEntries,
      db.pendingMutations,
    ],
    async () => {
      await Promise.all([
        db.profiles.delete(userId),
        db.dailyGoals.where("userId").equals(userId).delete(),
        db.tasks.where("userId").equals(userId).delete(),
        db.activeTimers.where("userId").equals(userId).delete(),
        db.timeEntries.where("userId").equals(userId).delete(),
        db.pendingMutations.where("userId").equals(userId).delete(),
      ]);
    },
  );
}
