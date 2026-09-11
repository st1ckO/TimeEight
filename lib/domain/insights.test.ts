import { describe, expect, it } from "vitest";
import type { TimeEntry } from "./types";
import { calculateInsights, mondayFor } from "./insights";

const entry = (
  id: string,
  localDate: string,
  durationSeconds: number,
): TimeEntry => ({
  id,
  userId: "u",
  taskId: "t",
  localDate,
  durationSeconds,
  source: "timer",
  startedAt: null,
  endedAt: null,
  manuallyAdjusted: false,
  correctionOriginalTaskId: null,
  correctionOriginalLocalDate: null,
  correctionOriginalDurationSeconds: null,
  mutationId: `m-${id}`,
});

describe("insight aggregation", () => {
  it("groups weeks Monday through Sunday and keeps overlaps additive", () => {
    const result = calculateInsights(
      [
        entry("1", "2026-09-07", 3600),
        entry("2", "2026-09-07", 1800),
        entry("3", "2026-09-13", 7200),
        entry("4", "2026-09-14", 900),
      ],
      "2026-09-14",
    );
    expect(result.mostTrackedWeek).toEqual({
      startDate: "2026-09-07",
      seconds: 12_600,
    });
    expect(result.mostTrackedDay).toEqual({
      date: "2026-09-13",
      seconds: 7200,
    });
    expect(result.currentWeekSeconds).toBe(900);
  });

  it("finds Monday for every day boundary", () => {
    expect(mondayFor("2026-09-13")).toBe("2026-09-07");
    expect(mondayFor("2026-09-14")).toBe("2026-09-14");
  });
});
