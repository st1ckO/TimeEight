import { localDateAt, splitDurationAcrossLocalDates } from "./time";
import { taskTargetForDate } from "./task-targets";
import type { ActiveTimer, Task, TaskDailyTarget, TimeEntry } from "./types";

export function overridesLimitOnDate(timer: ActiveTimer, date: string) {
  return (
    timer.limitOverride &&
    date === localDateAt(Date.parse(timer.startedAt), timer.timezone)
  );
}

/** Find the first limit reached, including days missed by delayed callbacks. */
export function timerLimitStopAt(
  timer: ActiveTimer,
  task: Task,
  entries: TimeEntry[],
  targets: TaskDailyTarget[],
  now: number,
): number | null {
  if (task.goalKind !== "limit") return null;
  const start = Date.parse(timer.startedAt);
  for (const slice of splitDurationAcrossLocalDates(
    timer.startedAt,
    new Date(now).toISOString(),
    timer.timezone,
  )) {
    if (overridesLimitOnDate(timer, slice.localDate)) continue;
    const previous = entries
      .filter(
        (entry) =>
          entry.taskId === task.id && entry.localDate === slice.localDate,
      )
      .reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const accumulated =
      Date.parse(slice.startedAt) === start ? timer.accumulatedSeconds : 0;
    const remaining = Math.max(
      0,
      taskTargetForDate(task, targets, slice.localDate) -
        previous -
        accumulated,
    );
    if (slice.durationSeconds >= remaining) {
      return Date.parse(slice.startedAt) + remaining * 1000;
    }
  }
  return null;
}
