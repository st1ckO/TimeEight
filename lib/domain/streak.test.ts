import { describe, expect, it } from "vitest";
import {
  aggregateStreakEntries,
  calculateStreak,
  nextSaverResetDate,
  nextStreakTierAt,
  STREAK_SECONDS,
  streakTierForDays,
} from "./streak";

describe("streak calculation", () => {
  it("excludes manual and corrected entries from qualifying time", () => {
    const totals = aggregateStreakEntries([
      {
        localDate: "2026-09-11",
        durationSeconds: 7_200,
        source: "timer",
        manuallyAdjusted: false,
      },
      {
        localDate: "2026-09-11",
        durationSeconds: 3_600,
        source: "recovered",
        manuallyAdjusted: false,
      },
      {
        localDate: "2026-09-11",
        durationSeconds: 10_800,
        source: "manual",
        manuallyAdjusted: true,
      },
      {
        localDate: "2026-09-11",
        durationSeconds: 10_800,
        source: "timer",
        manuallyAdjusted: true,
      },
    ]);

    expect(totals.get("2026-09-11")).toBe(STREAK_SECONDS);
  });

  it("upgrades the flame at the configured streak milestones", () => {
    expect(
      [0, 3, 10, 30, 100, 200].map((days) => streakTierForDays(days)),
    ).toEqual(["spark", "gold", "orange", "coral", "magenta", "violet"]);
    expect(nextStreakTierAt(30)).toBe(100);
    expect(nextStreakTierAt(200)).toBeNull();
  });

  it("resets the weekly saver at the next local Monday", () => {
    expect(nextSaverResetDate("2026-09-07")).toBe("2026-09-14");
    expect(nextSaverResetDate("2026-09-13")).toBe("2026-09-14");
  });

  it("counts four consecutive qualifying days", () => {
    const totals = new Map([
      ["2026-09-08", STREAK_SECONDS],
      ["2026-09-09", STREAK_SECONDS],
      ["2026-09-10", STREAK_SECONDS],
      ["2026-09-11", STREAK_SECONDS],
    ]);

    const result = calculateStreak(totals, "2026-09-11", "2026-09-08");

    expect(result.currentDays).toBe(4);
    expect(result.longestDays).toBe(4);
  });

  it("protects the first missed day in a Monday-Sunday week", () => {
    const totals = new Map([
      ["2026-09-07", STREAK_SECONDS],
      ["2026-09-09", STREAK_SECONDS],
    ]);
    const result = calculateStreak(totals, "2026-09-10", "2026-09-07");
    expect(result.currentDays).toBe(3);
    expect(result.protectedDates).toEqual(["2026-09-08"]);
    expect(result.saverAvailable).toBe(false);
  });

  it("ends a streak on the second missed day in the same week", () => {
    const totals = new Map([
      ["2026-09-07", STREAK_SECONDS],
      ["2026-09-10", STREAK_SECONDS],
    ]);
    const result = calculateStreak(totals, "2026-09-11", "2026-09-07");
    expect(result.currentDays).toBe(1);
    expect(result.protectedDates).toEqual(["2026-09-08"]);
  });

  it("does not consume today's saver before the day ends", () => {
    const totals = new Map([["2026-09-10", STREAK_SECONDS]]);
    const result = calculateStreak(totals, "2026-09-11", "2026-09-10");
    expect(result.currentDays).toBe(1);
    expect(result.saverAvailable).toBe(true);
  });
});
