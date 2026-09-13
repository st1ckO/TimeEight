import { taskTargetForDate } from "./task-targets";
import { localDateAt, splitDurationAcrossLocalDates } from "./time";
import type { ActiveTimer, Task, TaskDailyTarget, TimeEntry } from "./types";

/** Goal credit is capped per limit task/day, after combining every source. */
export function aggregateGoalProgress(
  entries: TimeEntry[],
  tasks: Task[],
  targets: TaskDailyTarget[],
  activeTimers: ActiveTimer[] = [],
  now = Date.now(),
): Map<string, number> {
  const byDate = new Map<string, Map<string, number>>();
  function add(taskId: string, date: string, seconds: number) {
    const byTask = byDate.get(date) ?? new Map<string, number>();
    byTask.set(taskId, (byTask.get(taskId) ?? 0) + seconds);
    byDate.set(date, byTask);
  }
  for (const entry of entries) {
    add(entry.taskId, entry.localDate, entry.durationSeconds);
  }
  for (const timer of activeTimers) {
    add(
      timer.taskId,
      localDateAt(Date.parse(timer.startedAt), timer.timezone),
      timer.accumulatedSeconds,
    );
    for (const slice of splitDurationAcrossLocalDates(
      timer.startedAt,
      new Date(now).toISOString(),
      timer.timezone,
    )) {
      add(timer.taskId, slice.localDate, slice.durationSeconds);
    }
  }
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const totals = new Map<string, number>();
  for (const [date, byTask] of byDate) {
    let total = 0;
    for (const [taskId, seconds] of byTask) {
      const task = tasksById.get(taskId);
      total +=
        task?.goalKind === "limit"
          ? Math.min(seconds, taskTargetForDate(task, targets, date))
          : seconds;
    }
    totals.set(date, total);
  }
  return totals;
}
