import { z } from "zod";
import { DAILY_GOAL_SECONDS } from "./time";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((timezone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid IANA timezone"),
  theme: z.enum(["system", "light", "dark"]),
});

export const dailyGoalSchema = z.object({
  effectiveDate: z.string().regex(isoDate),
  goalSeconds: z.literal(DAILY_GOAL_SECONDS),
});

export const taskSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(hexColor),
  goalKind: z.enum(["minimum", "limit"]),
  targetSeconds: z.number().int().min(60).max(86_400),
});

export const taskDailyTargetSchema = z.object({
  taskId: z.string().uuid(),
  localDate: z
    .string()
    .regex(isoDate)
    .refine((date) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
      );
    }, "Choose a valid local date"),
  targetSeconds: z.number().int().min(60).max(86_400),
});

export const taskSettingsSchema = taskSchema
  .omit({ targetSeconds: true })
  .extend({
    id: z.string().uuid(),
    targetSeconds: z.number().int().min(60).max(86_400).optional(),
  });

export const taskListStateSchema = z
  .object({
    id: z.string().uuid(),
    onDailyList: z.boolean(),
    archivedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .refine((task) => !task.archivedAt || !task.onDailyList, {
    message: "Archived tasks cannot be on the daily list",
  });

export const savedTaskSchema = taskSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sortOrder: z.number().int().nonnegative(),
  archivedAt: z.string().datetime({ offset: true }).nullable(),
  onDailyList: z.boolean(),
});

export const timerStartSchema = z.object({
  taskId: z.string().uuid(),
  startedAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64),
  mutationId: z.string().uuid(),
});

export const timeEntryCorrectionSchema = z.object({
  taskId: z.string().uuid(),
  localDate: z.string().regex(isoDate),
  durationSeconds: z.number().int().min(1).max(86_400),
  mutationId: z.string().uuid(),
});

export const syncMutationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "task-upsert",
    "task-archive",
    "task-list-state",
    "task-target-upsert",
    "task-target-snapshot",
    "task-settings-update",
    "timer-start",
    "timer-stop",
    "entry-upsert",
    "entry-delete",
    "profile-update",
    "goal-upsert",
  ]),
  createdAt: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
});

export const exportSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().datetime({ offset: true }),
  profile: profileSchema.extend({
    id: z.string(),
    onboardingCompleted: z.boolean(),
  }),
  tasks: z.array(z.unknown()),
  taskDailyTargets: z.array(z.unknown()).optional(),
  entries: z.array(z.unknown()),
});

export const accountOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("export") }),
  z.object({
    operation: z.literal("delete"),
    confirmation: z.literal("delete"),
  }),
]);
