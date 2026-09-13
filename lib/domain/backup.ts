import { z } from "zod";
import { profileSchema, taskSchema, taskDailyTargetSchema } from "./schemas";
import { DAILY_GOAL_SECONDS, localDateAt } from "./time";
import { taskTargetId } from "./task-targets";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid local date");
const uuid = z.string().uuid();
const owner = z.string().min(1).max(64);
const timestamp = z.string().datetime({ offset: true });
const entry = z
  .object({
    id: uuid,
    userId: owner,
    taskId: uuid,
    localDate: date,
    durationSeconds: z.number().int().min(1).max(86400),
    source: z.enum(["timer", "manual", "recovered"]),
    startedAt: timestamp.nullable(),
    endedAt: timestamp.nullable(),
    manuallyAdjusted: z.boolean(),
    correctionOriginalTaskId: uuid.nullable().default(null),
    correctionOriginalLocalDate: date.nullable().default(null),
    correctionOriginalDurationSeconds: z
      .number()
      .int()
      .min(1)
      .max(86400)
      .nullable()
      .default(null),
    mutationId: uuid,
  })
  .superRefine((value, context) => {
    const hasOriginal =
      value.correctionOriginalTaskId !== null &&
      value.correctionOriginalLocalDate !== null &&
      value.correctionOriginalDurationSeconds !== null;
    const noOriginal =
      value.correctionOriginalTaskId === null &&
      value.correctionOriginalLocalDate === null &&
      value.correctionOriginalDurationSeconds === null;
    if (
      value.source === "manual"
        ? !value.manuallyAdjusted || !noOriginal
        : value.manuallyAdjusted
          ? !hasOriginal && !noOriginal
          : !noOriginal
    )
      context.addIssue({ code: "custom", message: "Invalid correction state" });
    if (
      value.startedAt &&
      value.endedAt &&
      Date.parse(value.endedAt) <= Date.parse(value.startedAt)
    )
      context.addIssue({ code: "custom", message: "Invalid timer timestamps" });
  });
export const backupSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    exportedAt: timestamp,
    profile: profileSchema.extend({
      id: owner,
      onboardingCompleted: z.boolean(),
      accountStart: date.optional(),
    }),
    tasks: z
      .array(
        taskSchema.extend({
          id: uuid,
          userId: owner,
          sortOrder: z.number().int().nonnegative(),
          archivedAt: timestamp.nullable(),
          onDailyList: z.boolean(),
        }),
      )
      .max(1000),
    taskDailyTargets: z
      .array(
        taskDailyTargetSchema.extend({
          id: z.string().min(1).max(128),
          userId: owner,
        }),
      )
      .max(20000)
      .default([]),
    entries: z.array(entry).max(10000),
  })
  .superRefine((value, context) => {
    function reject(message: string) {
      context.addIssue({ code: "custom", message });
    }
    function unique(values: string[], label: string) {
      if (new Set(values).size !== values.length) reject("Duplicate " + label);
    }
    unique(
      value.tasks.map((task) => task.id),
      "task IDs",
    );
    unique(
      value.entries.map((item) => item.id),
      "entry IDs",
    );
    unique(
      value.entries.map((item) => item.mutationId),
      "entry mutation IDs",
    );

    unique(
      value.taskDailyTargets.map((target) => target.taskId + target.localDate),
      "daily targets",
    );
    unique(
      value.tasks
        .filter((task) => !task.archivedAt)
        .map((task) => String(task.sortOrder)),
      "active task order",
    );
    const tasks = new Set(value.tasks.map((task) => task.id));
    for (const task of value.tasks)
      if (task.archivedAt && task.onDailyList)
        reject("Archived task is on daily list");
    for (const item of value.entries)
      if (
        !tasks.has(item.taskId) ||
        (item.correctionOriginalTaskId &&
          !tasks.has(item.correctionOriginalTaskId))
      )
        reject("History references a missing task");
    for (const target of value.taskDailyTargets)
      if (!tasks.has(target.taskId))
        reject("Daily target references a missing task");
  });
export type Backup = z.infer<typeof backupSchema>;
// Daily goals are internal restore state, not part of exported backups.
export const restoreSnapshotSchema = backupSchema.safeExtend({
  dailyGoals: z
    .array(
      z.object({
        id: uuid,
        userId: owner,
        effectiveDate: date,
        goalSeconds: z.literal(DAILY_GOAL_SECONDS),
      }),
    )
    .length(1),
});
export type RestoreSnapshot = z.infer<typeof restoreSnapshotSchema>;

export function prepareBackup(
  input: unknown,
  userId: string,
  accountStart: string,
  now = Date.now(),
): RestoreSnapshot {
  const backup = backupSchema.parse(input);
  const ids = new Map(
    backup.tasks.map((task) => [task.id, crypto.randomUUID()]),
  );
  const today = localDateAt(now, backup.profile.timezone);
  const start = [
    accountStart,
    backup.profile.accountStart ?? accountStart,
    today,
    ...backup.entries.map((item) => item.localDate),
  ].sort()[0]!;
  return {
    ...backup,
    schemaVersion: 2,
    profile: { ...backup.profile, id: userId, accountStart: start },
    dailyGoals: [
      {
        id: crypto.randomUUID(),
        userId,
        effectiveDate: start,
        goalSeconds: DAILY_GOAL_SECONDS,
      },
    ],
    tasks: backup.tasks.map((task) => ({
      ...task,
      id: ids.get(task.id)!,
      userId,
    })),
    taskDailyTargets: backup.taskDailyTargets.map((target) => {
      const taskId = ids.get(target.taskId)!;
      return {
        ...target,
        id: taskTargetId(taskId, target.localDate),
        taskId,
        userId,
      };
    }),
    entries: backup.entries.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      userId,
      taskId: ids.get(item.taskId)!,
      correctionOriginalTaskId: item.correctionOriginalTaskId
        ? ids.get(item.correctionOriginalTaskId)!
        : null,
      mutationId: crypto.randomUUID(),
    })),
  };
}
