import { describe, expect, it } from "vitest";
import { calculateStreak, STREAK_SECONDS } from "./streak";

describe("streak calculation", () => {
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
