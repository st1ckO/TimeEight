import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  timezone: z.string().trim().min(1).max(64),
  theme: z.enum(["system", "light", "dark"]),
});

export const dailyGoalSchema = z.object({
  effectiveDate: z.string().regex(isoDate),
  goalSeconds: z.number().int().min(900).max(86_400),
});

export const taskSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(hexColor),
  goalKind: z.enum(["minimum", "limit"]),
  targetSeconds: z.number().int().min(60).max(86_400),
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
    "timer-start",
    "timer-stop",
    "entry-upsert",
    "entry-delete",
  ]),
  createdAt: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
});
