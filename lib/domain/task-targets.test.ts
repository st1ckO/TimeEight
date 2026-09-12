import { describe, expect, it } from "vitest";
import type { Task } from "./types";
import {
  allotmentStopsTimer,
  missingTaskTargets,
  taskTargetForDate,
} from "./task-targets";
import { taskDailyTargetSchema } from "./schemas";

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

describe("task allotments by local date", () => {
  it("uses a temporary target only on its date, then resets to the default", () => {
    const targets = missingTaskTargets(
      [task],
      [],
      [{ taskId: task.id, localDate: "2026-09-12" }],
    ).map((target) => ({ ...target, targetSeconds: 1200 }));
    expect(taskTargetForDate(task, targets, "2026-09-12")).toBe(1200);
    expect(taskTargetForDate(task, targets, "2026-09-13")).toBe(3600);
    expect(task.targetSeconds).toBe(3600);
  });
  it("keeps historical snapshots after a default changes and does not seed duplicates", () => {
    const choices = [
      { taskId: task.id, localDate: "2026-09-11" },
      { taskId: task.id, localDate: "2026-09-11" },
    ];
    const targets = missingTaskTargets([task], [], choices);
    expect(targets).toHaveLength(1);
    expect(missingTaskTargets([task], targets, choices)).toEqual([]);
    const changed = { ...task, targetSeconds: 7200 };
    expect(taskTargetForDate(changed, targets, "2026-09-11")).toBe(3600);
    expect(taskTargetForDate(changed, targets, "2026-09-13")).toBe(7200);
  });
  it("requires a stop only for a running limit at or beyond the new target", () => {
    expect(allotmentStopsTimer("limit", 600, 900, true)).toBe(true);
    expect(allotmentStopsTimer("limit", 600, 600, true)).toBe(true);
    expect(allotmentStopsTimer("minimum", 600, 900, true)).toBe(false);
    expect(allotmentStopsTimer("limit", 1200, 900, true)).toBe(false);
    expect(allotmentStopsTimer("limit", 600, 900, false)).toBe(false);
  });
  it("validates real dates and duration bounds", () => {
    const target = {
      taskId: task.id,
      localDate: "2026-09-12",
      targetSeconds: 60,
    };
    expect(taskDailyTargetSchema.safeParse(target).success).toBe(true);
    for (const invalid of [
      { ...target, localDate: "2026-02-30" },
      { ...target, targetSeconds: 0 },
      { ...target, targetSeconds: 86401 },
      { ...target, taskId: "invalid" },
    ]) {
      expect(taskDailyTargetSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
