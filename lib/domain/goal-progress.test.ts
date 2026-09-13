import { describe, expect, it } from "vitest";
import { aggregateGoalProgress } from "./goal-progress";
import { correctTimeEntry, revertTimeEntryCorrection } from "./corrections";
import { aggregateEntries } from "./time";
import type { ActiveTimer, Task, TimeEntry } from "./types";

const date = "2026-09-13";
const task: Task = {
  id: "limit",
  userId: "owner",
  name: "Limit",
  color: "#197c67",
  goalKind: "limit",
  targetSeconds: 3600,
  sortOrder: 0,
  archivedAt: null,
  onDailyList: true,
};
function entry(seconds: number, changes: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "entry",
    userId: "owner",
    taskId: task.id,
    localDate: date,
    durationSeconds: seconds,
    source: "timer",
    startedAt: `${date}T01:00:00Z`,
    endedAt: `${date}T02:00:00Z`,
    manuallyAdjusted: false,
    correctionOriginalTaskId: null,
    correctionOriginalLocalDate: null,
    correctionOriginalDurationSeconds: null,
    mutationId: "mutation",
    ...changes,
  };
}
const target = (seconds: number, localDate = date) => ({
  id: `limit:${localDate}`,
  userId: "owner",
  taskId: task.id,
  localDate,
  targetSeconds: seconds,
});
describe("daily goal credit", () => {
  it("credits only actual time below the limit and caps all sessions together", () => {
    expect(aggregateGoalProgress([entry(1200)], [task], []).get(date)).toBe(
      1200,
    );
    const entries = [entry(3000), entry(2400, { id: "extra" })];
    expect(aggregateGoalProgress(entries, [task], []).get(date)).toBe(3600);
    expect(aggregateEntries(entries).get(date)).toBe(5400);
  });
  it("combines manual, corrected, and recovered time before applying the cap", () => {
    const entries = [
      entry(1800),
      entry(1800, { source: "manual" }),
      entry(1800, { manuallyAdjusted: true }),
      entry(1800, { source: "recovered" }),
    ];
    expect(aggregateGoalProgress(entries, [task], []).get(date)).toBe(3600);
    expect(
      aggregateGoalProgress([...entries].reverse(), [task], []).get(date),
    ).toBe(3600);
  });
  it("uses each historical daily target and caps tasks independently", () => {
    const build = { ...task, id: "build", goalKind: "minimum" as const };
    const other = {
      ...task,
      id: "other",
      archivedAt: `${date}T00:00:00Z`,
      onDailyList: false,
    };
    const entries = [
      entry(9000),
      entry(9000, { taskId: build.id }),
      entry(9000, { taskId: other.id }),
      entry(9000, { localDate: "2026-09-14" }),
    ];
    const totals = aggregateGoalProgress(
      entries,
      [task, build, other],
      [target(1800)],
    );
    expect(totals.get(date)).toBe(1800 + 9000 + 3600);
    expect(totals.get("2026-09-14")).toBe(3600);
    expect(
      aggregateGoalProgress(entries, [task, build, other], [target(7200)]).get(
        date,
      ),
    ).toBe(7200 + 9000 + 3600);
  });
  it("recalculates credit after corrections, reverts, and deletion", () => {
    const original = entry(1800);
    const corrected = correctTimeEntry(original, {
      taskId: task.id,
      localDate: date,
      durationSeconds: 9000,
    });
    expect(aggregateGoalProgress([corrected], [task], []).get(date)).toBe(3600);
    expect(
      aggregateGoalProgress(
        [revertTimeEntryCorrection(corrected)!],
        [task],
        [],
      ).get(date),
    ).toBe(1800);
    expect(aggregateGoalProgress([], [task], []).get(date)).toBeUndefined();
  });
  it("caps live override time together with saved time and resets at local midnight", () => {
    const timer: ActiveTimer = {
      id: "timer",
      userId: "owner",
      taskId: task.id,
      startedAt: "2026-09-13T15:30:00Z",
      timezone: "Asia/Manila",
      accumulatedSeconds: 600,
      checkpointSeconds: 0,
      checkpointedAt: "2026-09-13T15:30:00Z",
      limitOverride: true,
      mutationId: "timer-mutation",
    };
    const totals = aggregateGoalProgress(
      [entry(3000)],
      [task],
      [target(1200, "2026-09-14")],
      [timer],
      Date.parse("2026-09-13T16:30:00Z"),
    );
    expect(totals.get(date)).toBe(3600);
    expect(totals.get("2026-09-14")).toBe(1200);
  });
});
