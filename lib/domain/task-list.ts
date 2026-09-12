import type { Task } from "./types";

// Older browser records predate daily-list selection. Keep their visible tasks.
export function normalizeTask(task: Task): Task {
  return {
    ...task,
    onDailyList: task.archivedAt ? false : (task.onDailyList ?? true),
  };
}

export function dailyTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => !task.archivedAt && task.onDailyList)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function nextTaskOrder(tasks: Task[]): number {
  return Math.max(-1, ...tasks.map((task) => task.sortOrder)) + 1;
}

export function removeFromDailyList(task: Task): Task {
  return { ...task, onDailyList: false };
}

export function archiveSavedTask(task: Task, archivedAt: string): Task {
  return { ...task, onDailyList: false, archivedAt };
}

export function restoreSavedTask(task: Task): Task {
  return { ...task, archivedAt: null, onDailyList: false };
}
