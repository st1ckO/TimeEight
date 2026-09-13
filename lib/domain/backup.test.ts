import { describe, expect, it } from "vitest";
import { backupSchema, prepareBackup } from "./backup";
import { aggregateStreakEntries } from "./streak";
import { aggregateGoalProgress } from "./goal-progress";

function fixture() {
  const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    schemaVersion: 1,
    exportedAt: "2026-09-13T12:00:00Z",
    profile: {
      id: "foreign-owner",
      displayName: "Restored",
      timezone: "Asia/Manila",
      theme: "dark",
      onboardingCompleted: true,
      accountStart: "2020-01-01",
    },
    tasks: [
      {
        id: taskId,
        userId: "foreign-owner",
        name: "Restored task",
        color: "#197c67",
        goalKind: "minimum",
        targetSeconds: 3600,
        sortOrder: 0,
        archivedAt: null,
        onDailyList: true,
      },
    ],
    dailyGoals: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        userId: "foreign-owner",
        effectiveDate: "2020-01-01",
        goalSeconds: 14400,
      },
    ],
    taskDailyTargets: [
      {
        id: "old-target",
        userId: "foreign-owner",
        taskId,
        localDate: "2020-01-01",
        targetSeconds: 1800,
      },
    ],
    entries: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        userId: "foreign-owner",
        taskId,
        localDate: "2020-01-01",
        durationSeconds: 3600,
        source: "timer",
        startedAt: "2020-01-01T01:00:00Z",
        endedAt: "2020-01-01T02:00:00Z",
        manuallyAdjusted: false,
        correctionOriginalTaskId: null,
        correctionOriginalLocalDate: null,
        correctionOriginalDurationSeconds: null,
        mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    ],
  };
}

describe("backup restore validation", () => {
  it("preserves limit credit through a current-version backup round trip", () => {
    const { dailyGoals, ...input } = fixture();
    void dailyGoals;
    input.tasks[0]!.goalKind = "limit";
    const restored = prepareBackup(
      { ...input, schemaVersion: 2 },
      "local-demo",
      "2026-09-13",
    );
    const exported = backupSchema.parse({
      ...restored,
      exportedAt: "2026-09-13T12:00:00Z",
    });
    const roundTrip = prepareBackup(exported, "local-demo", "2026-09-13");
    expect(
      aggregateGoalProgress(
        roundTrip.entries,
        roundTrip.tasks,
        roundTrip.taskDailyTargets,
      ).get("2020-01-01"),
    ).toBe(1800);
    expect(roundTrip.entries[0]!.durationSeconds).toBe(3600);
  });
  it("accepts version 2 backups without goals and ignores legacy goal data", () => {
    const { dailyGoals, ...input } = fixture();
    void dailyGoals;
    const modern = prepareBackup(
      { ...input, schemaVersion: 2 },
      "local-demo",
      "2026-09-13",
    );
    const legacy = prepareBackup(
      { ...input, dailyGoals: [{ goalSeconds: 21600 }] },
      "local-demo",
      "2026-09-13",
    );
    expect(modern.dailyGoals[0]!.goalSeconds).toBe(28800);
    expect(legacy.dailyGoals[0]!.goalSeconds).toBe(28800);
    expect(modern.dailyGoals[0]!.effectiveDate).toBe("2020-01-01");
  });
  it.each([false, true])(
    "accepts legacy history without correction originals (adjusted: %s)",
    (adjusted) => {
      const input = fixture();
      const {
        correctionOriginalTaskId,
        correctionOriginalLocalDate,
        correctionOriginalDurationSeconds,
        ...legacy
      } = input.entries[0]!;
      void correctionOriginalTaskId;
      void correctionOriginalLocalDate;
      void correctionOriginalDurationSeconds;
      const result = prepareBackup(
        { ...input, entries: [{ ...legacy, manuallyAdjusted: adjusted }] },
        "local-demo",
        "2026-09-13",
      );
      expect(result.entries[0]!.source).toBe("timer");
      expect(result.entries[0]!.correctionOriginalDurationSeconds).toBeNull();
      expect(aggregateStreakEntries(result.entries).size).toBe(
        adjusted ? 0 : 1,
      );
    },
  );
  it("remaps ownership and IDs while preserving history and streak eligibility", () => {
    const input = fixture();
    const result = prepareBackup(
      input,
      "local-demo",
      "2026-09-13",
      Date.parse("2026-09-13T12:00:00Z"),
    );
    expect(result.profile.id).toBe("local-demo");
    expect(result.tasks[0]!.id).not.toBe(input.tasks[0]!.id);
    expect(result.entries[0]!.taskId).toBe(result.tasks[0]!.id);
    expect(result.entries[0]!.userId).toBe("local-demo");
    expect(result.entries[0]!.mutationId).not.toBe(
      input.entries[0]!.mutationId,
    );
    expect(result.taskDailyTargets[0]!.taskId).toBe(result.tasks[0]!.id);
    expect(result.schemaVersion).toBe(2);
    expect(result.dailyGoals).toEqual([
      expect.objectContaining({
        effectiveDate: "2020-01-01",
        goalSeconds: 28800,
      }),
    ]);
    expect(backupSchema.parse(input)).not.toHaveProperty("dailyGoals");
    expect(aggregateStreakEntries(result.entries).get("2020-01-01")).toBe(3600);
    expect(result.profile.accountStart).toBe("2020-01-01");
    expect(input.profile.id).toBe("foreign-owner");
  });
  it("keeps correction originals linked to remapped tasks without qualifying for streaks", () => {
    const input = fixture();
    Object.assign(input.entries[0]!, {
      manuallyAdjusted: true,
      correctionOriginalTaskId: input.tasks[0]!.id,
      correctionOriginalLocalDate: "2020-01-01",
      correctionOriginalDurationSeconds: 1800,
    });
    const result = prepareBackup(input, "local-demo", "2026-09-13");
    expect(result.entries[0]!.correctionOriginalTaskId).toBe(
      result.tasks[0]!.id,
    );
    expect(aggregateStreakEntries(result.entries).size).toBe(0);
  });
  it.each([
    "missing task",
    "invalid date",
    "duplicate IDs",
    "invalid correction",
    "wrong version",
  ])("rejects %s before replacing data", (kind) => {
    const input = fixture();
    if (kind === "missing task") input.tasks = [];
    if (kind === "invalid date") input.entries[0]!.localDate = "2020-02-30";
    if (kind === "duplicate IDs") input.entries.push({ ...input.entries[0]! });
    if (kind === "invalid correction")
      Object.assign(input.entries[0]!, {
        correctionOriginalTaskId: input.tasks[0]!.id,
      });
    if (kind === "wrong version") input.schemaVersion = 99;
    expect(backupSchema.safeParse(input).success).toBe(false);
  });
  it("accepts old exports without daily targets and adds a fixed current goal", () => {
    const { taskDailyTargets, ...input } = fixture();
    void taskDailyTargets;
    const result = prepareBackup(input, "local-demo", "2026-09-13");
    expect(result.taskDailyTargets).toEqual([]);
    expect(result.dailyGoals.some((goal) => goal.goalSeconds === 28800)).toBe(
      true,
    );
  });
});
