import { describe, expect, it } from "vitest";
import { historyOverLimitSeconds } from "./limit-display";
import {
  aggregateEntries,
  formatSignedDuration,
  taskDisplaySeconds,
} from "./time";
import type { Task, TimeEntry } from "./types";

const task: Task = {
  id: "task",
  userId: "owner",
  name: "Limit",
  color: "#197c67",
  goalKind: "limit",
  targetSeconds: 60,
  sortOrder: 0,
  archivedAt: null,
  onDailyList: true,
};
function entry(id: string, seconds: number, hour: number): TimeEntry {
  return {
    id,
    userId: "owner",
    taskId: task.id,
    localDate: "2026-09-13",
    durationSeconds: seconds,
    source: "timer",
    startedAt: `2026-09-13T0${hour}:00:00Z`,
    endedAt: `2026-09-13T0${hour}:01:00Z`,
    manuallyAdjusted: false,
    correctionOriginalTaskId: null,
    correctionOriginalLocalDate: null,
    correctionOriginalDurationSeconds: null,
    mutationId: id,
  };
}
describe("signed limit presentation", () => {
  it("counts past zero without changing build timers or unsigned formatting", () => {
    expect(taskDisplaySeconds("limit", 65, 60)).toBe(-5);
    expect(taskDisplaySeconds("minimum", 65, 60)).toBe(65);
    expect(formatSignedDuration(-5, { clock: true })).toBe("−00:00:05");
    expect(formatSignedDuration(-300)).toBe("−5m");
    expect(formatSignedDuration(0)).toBe("0s");
  });
  it("shows each continuation independently of sorting and keeps daily totals positive", () => {
    const entries = [
      entry("limit", 60, 1),
      entry("extra1", 5, 2),
      entry("extra2", 10, 3),
    ];
    expect(historyOverLimitSeconds([...entries].reverse(), [task], [])).toEqual(
      new Map([
        ["extra1", 5],
        ["extra2", 10],
      ]),
    );
    expect(aggregateEntries(entries).get("2026-09-13")).toBe(75);
    expect(entries.map((e) => e.durationSeconds)).toEqual([60, 5, 10]);
  });
  it("uses historical allotments and resets at local-date boundaries", () => {
    const later = { ...entry("tomorrow", 30, 3), localDate: "2026-09-14" };
    const targets = [
      {
        id: "target",
        userId: "owner",
        taskId: task.id,
        localDate: "2026-09-13",
        targetSeconds: 90,
      },
    ];
    expect(
      historyOverLimitSeconds(
        [entry("partial", 100, 1), later],
        [task],
        targets,
      ),
    ).toEqual(new Map([["partial", 10]]));
    expect(
      historyOverLimitSeconds(
        [entry("build", 100, 1)],
        [{ ...task, goalKind: "minimum" }],
        [],
      ),
    ).toEqual(new Map());
  });
  it("keeps manual additions positive while including them in the limit baseline", () => {
    const manual = {
      ...entry("manual", 60, 1),
      source: "manual" as const,
      startedAt: null,
      endedAt: null,
      manuallyAdjusted: true,
    };
    expect(
      historyOverLimitSeconds([entry("extra", 5, 2), manual], [task], []),
    ).toEqual(new Map([["extra", 5]]));
  });
});
