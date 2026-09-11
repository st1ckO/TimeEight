import { describe, expect, it } from "vitest";
import type { TimeEntry } from "./types";
import {
  canRevertTimeEntryCorrection,
  correctTimeEntry,
  revertTimeEntryCorrection,
} from "./corrections";
import { aggregateStreakEntries } from "./streak";

const timerEntry: TimeEntry = {
  id: "entry-1",
  userId: "user-1",
  taskId: "task-original",
  localDate: "2026-09-12",
  durationSeconds: 3_600,
  source: "timer",
  startedAt: "2026-09-12T01:00:00.000Z",
  endedAt: "2026-09-12T02:00:00.000Z",
  manuallyAdjusted: false,
  correctionOriginalTaskId: null,
  correctionOriginalLocalDate: null,
  correctionOriginalDurationSeconds: null,
  mutationId: "mutation-1",
};

describe("time-entry corrections", () => {
  it("preserves the original timer values across repeated corrections", () => {
    const first = correctTimeEntry(timerEntry, {
      taskId: "task-corrected",
      localDate: "2026-09-13",
      durationSeconds: 1_800,
    });
    const second = correctTimeEntry(first, {
      taskId: "task-corrected-again",
      localDate: "2026-09-14",
      durationSeconds: 900,
    });

    expect(second).toMatchObject({
      manuallyAdjusted: true,
      correctionOriginalTaskId: "task-original",
      correctionOriginalLocalDate: "2026-09-12",
      correctionOriginalDurationSeconds: 3_600,
    });
  });

  it("restores a corrected timer entry and its streak eligibility", () => {
    const corrected = correctTimeEntry(timerEntry, {
      taskId: "task-corrected",
      localDate: "2026-09-13",
      durationSeconds: 1_800,
    });

    const reverted = revertTimeEntryCorrection(corrected);

    expect(aggregateStreakEntries([corrected]).get("2026-09-13")).toBe(
      undefined,
    );
    expect(reverted).toEqual(timerEntry);
    expect(aggregateStreakEntries([reverted!]).get("2026-09-12")).toBe(3_600);
  });

  it("does not make manual entries eligible for revert", () => {
    const manual = correctTimeEntry(
      {
        ...timerEntry,
        source: "manual",
        manuallyAdjusted: true,
        startedAt: null,
        endedAt: null,
      },
      {
        taskId: "task-corrected",
        localDate: "2026-09-13",
        durationSeconds: 1_800,
      },
    );

    expect(canRevertTimeEntryCorrection(manual)).toBe(false);
    expect(revertTimeEntryCorrection(manual)).toBeNull();
  });
});
