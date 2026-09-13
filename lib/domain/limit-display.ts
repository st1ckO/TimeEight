import type { Task, TaskDailyTarget, TimeEntry } from "./types";
import { taskTargetForDate } from "./task-targets";

// Presentation only: stored durations remain positive for aggregation and editing.
export function historyOverLimitSeconds(
  entries: TimeEntry[],
  tasks: Task[],
  targets: TaskDailyTarget[],
): Map<string, number> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const tracked = new Map<string, number>();
  const result = new Map<string, number>();
  // Manual additions have no timestamps; include them in the daily limit baseline.
  const chronological = [...entries].sort(
    (a, b) =>
      (a.startedAt ?? "").localeCompare(b.startedAt ?? "") ||
      a.id.localeCompare(b.id),
  );
  for (const entry of chronological) {
    const task = taskById.get(entry.taskId);
    const key = entry.taskId + ":" + entry.localDate;
    const before = tracked.get(key) ?? 0;
    if (task?.goalKind === "limit" && entry.source !== "manual") {
      const limit = taskTargetForDate(task, targets, entry.localDate);
      const extra =
        Math.max(0, before + entry.durationSeconds - limit) -
        Math.max(0, before - limit);
      if (extra > 0) result.set(entry.id, extra);
    }
    tracked.set(key, before + entry.durationSeconds);
  }
  return result;
}
