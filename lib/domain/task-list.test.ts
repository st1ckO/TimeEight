import { describe, expect, it } from "vitest";
import type { Task } from "./types";
import {
  archiveSavedTask,
  dailyTasks,
  nextTaskOrder,
  normalizeTask,
  removeFromDailyList,
  restoreSavedTask,
} from "./task-list";
import { taskListStateSchema } from "./schemas";

const task: Task = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId: "user-1",
  name: "Reading",
  color: "#197c67",
  goalKind: "minimum",
  targetSeconds: 3600,
  sortOrder: 0,
  archivedAt: null,
  onDailyList: true,
};

describe("saved tasks and daily-list selection", () => {
  it("removes only selection, preserving the saved task and original input", () => {
    const removed = removeFromDailyList(task);
    expect(removed).toEqual({ ...task, onDailyList: false });
    expect(task.onDailyList).toBe(true);
    expect(dailyTasks([removed])).toEqual([]);
  });

  it("archives without deleting and restores only to the saved library", () => {
    const archived = archiveSavedTask(task, "2026-09-12T01:00:00.000Z");
    expect(archived.onDailyList).toBe(false);
    expect(dailyTasks([archived])).toEqual([]);
    expect(restoreSavedTask(archived)).toEqual({ ...task, onDailyList: false });
  });

  it("keeps choices without a date reset and sorts only visible tasks", () => {
    const later = { ...task, id: "later", sortOrder: 9 };
    const removed = { ...task, id: "removed", onDailyList: false };
    const archived = {
      ...task,
      id: "archived",
      archivedAt: "2026-09-12T01:00:00.000Z",
    };
    expect(
      dailyTasks([later, removed, archived, task]).map((item) => item.id),
    ).toEqual([task.id, "later"]);
    expect(dailyTasks([task, removed])).toEqual(dailyTasks([task, removed]));
    expect(nextTaskOrder([later, removed])).toBe(10);
    expect(nextTaskOrder([])).toBe(0);
  });

  it("migrates old records without resurrecting archived tasks", () => {
    const legacy = { ...task, onDailyList: undefined } as unknown as Task;
    expect(normalizeTask(legacy).onDailyList).toBe(true);
    expect(
      normalizeTask({ ...legacy, archivedAt: "2026-09-12T01:00:00.000Z" })
        .onDailyList,
    ).toBe(false);
    expect(normalizeTask(removeFromDailyList(task)).onDailyList).toBe(false);
  });

  it("rejects malformed list state and archived selection at runtime", () => {
    expect(taskListStateSchema.safeParse(task).success).toBe(true);
    expect(
      taskListStateSchema.safeParse({ ...task, onDailyList: "true" }).success,
    ).toBe(false);
    expect(
      taskListStateSchema.safeParse({ ...task, id: "not-an-id" }).success,
    ).toBe(false);
    expect(
      taskListStateSchema.safeParse({
        ...task,
        archivedAt: "2026-09-12T01:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
