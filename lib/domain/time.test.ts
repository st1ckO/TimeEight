import { describe, expect, it } from "vitest";
import {
  aggregateEntries,
  elapsedSeconds,
  elapsedSecondsForDate,
  formatDuration,
  goalForDate,
  splitDurationAcrossLocalDates,
} from "./time";

describe("time domain", () => {
  it("derives elapsed time from timestamps instead of callback counts", () => {
    const timer = {
      startedAt: "2026-09-11T00:00:00.000Z",
      accumulatedSeconds: 30,
    };
    expect(elapsedSeconds(timer, Date.parse("2026-09-11T00:01:10.000Z"))).toBe(
      100,
    );
  });

  it("splits a running timer at local midnight", () => {
    const slices = splitDurationAcrossLocalDates(
      "2026-09-11T15:59:30.000Z",
      "2026-09-11T16:00:30.000Z",
      "Asia/Manila",
    );
    expect(
      slices.map(({ localDate, durationSeconds }) => ({
        localDate,
        durationSeconds,
      })),
    ).toEqual([
      { localDate: "2026-09-11", durationSeconds: 30 },
      { localDate: "2026-09-12", durationSeconds: 30 },
    ]);
  });

  it("counts only the requested local date for a timer crossing midnight", () => {
    const timer = {
      startedAt: "2026-09-11T15:59:30.000Z",
      timezone: "Asia/Manila",
      accumulatedSeconds: 0,
    };
    const now = Date.parse("2026-09-11T16:00:30.000Z");
    expect(elapsedSecondsForDate(timer, "2026-09-11", now)).toBe(30);
    expect(elapsedSecondsForDate(timer, "2026-09-12", now)).toBe(30);
  });

  it("looks up the historical daily goal", () => {
    const goals = [
      { effectiveDate: "2026-09-01", goalSeconds: 28_800 },
      { effectiveDate: "2026-09-10", goalSeconds: 14_400 },
    ];
    expect(goalForDate(goals, "2026-09-09")).toBe(28_800);
    expect(goalForDate(goals, "2026-09-11")).toBe(14_400);
  });

  it("adds overlapping entries independently", () => {
    const entries = [
      {
        id: "1",
        userId: "user",
        taskId: "a",
        localDate: "2026-09-11",
        durationSeconds: 3600,
        source: "timer" as const,
        startedAt: null,
        endedAt: null,
        manuallyAdjusted: false,
        correctionOriginalTaskId: null,
        correctionOriginalLocalDate: null,
        correctionOriginalDurationSeconds: null,
        mutationId: "m1",
      },
      {
        id: "2",
        userId: "user",
        taskId: "b",
        localDate: "2026-09-11",
        durationSeconds: 1800,
        source: "timer" as const,
        startedAt: null,
        endedAt: null,
        manuallyAdjusted: false,
        correctionOriginalTaskId: null,
        correctionOriginalLocalDate: null,
        correctionOriginalDurationSeconds: null,
        mutationId: "m2",
      },
    ];
    expect(aggregateEntries(entries).get("2026-09-11")).toBe(5400);
  });

  it("formats compact and clock durations", () => {
    expect(formatDuration(5530)).toBe("1h 32m");
    expect(formatDuration(5530, { clock: true })).toBe("01:32:10");
  });
});
