import { describe, expect, it } from "vitest";
import {
  dailyGoalSchema,
  taskSchema,
  timeEntryCorrectionSchema,
} from "./schemas";

describe("domain input schemas", () => {
  it("accepts a daily goal below the streak threshold", () => {
    expect(
      dailyGoalSchema.parse({ effectiveDate: "2026-09-11", goalSeconds: 3600 })
        .goalSeconds,
    ).toBe(3600);
  });

  it("rejects invalid task colors and empty names", () => {
    expect(() =>
      taskSchema.parse({
        name: "",
        color: "teal",
        goalKind: "minimum",
        targetSeconds: 3600,
      }),
    ).toThrow();
  });

  it("keeps corrections duration-based and within one day", () => {
    expect(() =>
      timeEntryCorrectionSchema.parse({
        taskId: crypto.randomUUID(),
        localDate: "2026-09-11",
        durationSeconds: 86_401,
        mutationId: crypto.randomUUID(),
      }),
    ).toThrow();
  });
});
