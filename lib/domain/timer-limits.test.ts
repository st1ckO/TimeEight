import { describe, expect, it } from "vitest";
import { timerLimitStopAt, overridesLimitOnDate } from "./timer-limits";
import { splitDurationAcrossLocalDates } from "./time";
import type { ActiveTimer, Task, TimeEntry } from "./types";

const task: Task = {
  id: "task",
  userId: "owner",
  name: "Limit",
  color: "#197c67",
  goalKind: "limit",
  targetSeconds: 3600,
  sortOrder: 0,
  archivedAt: null,
  onDailyList: true,
};
const timer: ActiveTimer = {
  id: "timer",
  userId: "owner",
  taskId: task.id,
  startedAt: "2026-09-13T15:00:00Z",
  timezone: "Asia/Manila",
  accumulatedSeconds: 0,
  checkpointedAt: "2026-09-13T15:00:00Z",
  checkpointSeconds: 0,
  limitOverride: false,
  mutationId: "timer",
};
const stop = (value: ActiveTimer, now: string, entries: TimeEntry[] = []) =>
  timerLimitStopAt(value, task, entries, [], Date.parse(now));
describe("timer limit stopping", () => {
  it("splits precisely at midnight without moving a second between days", () => {
    const slices = splitDurationAcrossLocalDates(
      timer.startedAt,
      "2026-09-13T18:00:00Z",
      timer.timezone,
    );
    expect(slices.map((slice) => slice.durationSeconds)).toEqual([3600, 7200]);
    expect(slices[1]!.startedAt).toBe("2026-09-13T16:00:00.000Z");
  });
  it("finds yesterday's limit even when the callback runs after midnight", () => {
    expect(stop(timer, "2026-09-13T15:59:59Z")).toBeNull();
    expect(stop(timer, "2026-09-13T17:00:00Z")).toBe(
      Date.parse("2026-09-13T16:00:00Z"),
    );
  });
  it("expires override at the timer's local midnight and stops at the new allowance", () => {
    const overridden = { ...timer, limitOverride: true };
    expect(overridesLimitOnDate(overridden, "2026-09-13")).toBe(true);
    expect(overridesLimitOnDate(overridden, "2026-09-14")).toBe(false);
    expect(stop(overridden, "2026-09-13T16:30:00Z")).toBeNull();
    expect(stop(overridden, "2026-09-13T18:00:00Z")).toBe(
      Date.parse("2026-09-13T17:00:00Z"),
    );
  });
  it("continues through midnight if the previous allowance was not reached", () => {
    const late = { ...timer, startedAt: "2026-09-13T15:45:00Z" };
    expect(stop(late, "2026-09-13T16:30:00Z")).toBeNull();
    expect(stop(late, "2026-09-13T18:00:00Z")).toBe(
      Date.parse("2026-09-13T17:00:00Z"),
    );
  });
  it("includes saved entries and historical targets in the exact cutoff", () => {
    const entry = {
      taskId: task.id,
      localDate: "2026-09-13",
      durationSeconds: 900,
    } as TimeEntry;
    const targets = [
      {
        id: "target",
        userId: "owner",
        taskId: task.id,
        localDate: "2026-09-13",
        targetSeconds: 1800,
      },
    ];
    expect(
      timerLimitStopAt(
        timer,
        task,
        [entry],
        targets,
        Date.parse("2026-09-13T17:00:00Z"),
      ),
    ).toBe(Date.parse("2026-09-13T15:15:00Z"));
    expect(
      stop({ ...timer, accumulatedSeconds: 600 }, "2026-09-13T17:00:00Z"),
    ).toBe(Date.parse("2026-09-13T15:50:00Z"));
  });
  it("leaves build timers unrestricted and handles daylight-saving dates", () => {
    expect(
      timerLimitStopAt(
        timer,
        { ...task, goalKind: "minimum" },
        [],
        [],
        Date.parse("2026-09-15T00:00:00Z"),
      ),
    ).toBeNull();
    const dst = {
      ...timer,
      startedAt: "2026-11-01T03:30:00Z",
      timezone: "America/New_York",
      limitOverride: true,
    };
    expect(stop(dst, "2026-11-01T08:00:00Z")).toBe(
      Date.parse("2026-11-01T05:00:00Z"),
    );
  });
});
