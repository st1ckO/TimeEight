import { describe, expect, it } from "vitest";
import {
  accountOperationSchema,
  dailyGoalSchema,
  profileSchema,
  taskSchema,
  timeEntryCorrectionSchema,
} from "./schemas";
import { DISPLAY_NAME_MAX_LENGTH } from "./profile";

describe("domain input schemas", () => {
  it("accepts only the fixed eight-hour daily goal", () => {
    expect(
      dailyGoalSchema.parse({
        effectiveDate: "2026-09-11",
        goalSeconds: 28_800,
      }).goalSeconds,
    ).toBe(28_800);
    expect(() =>
      dailyGoalSchema.parse({ effectiveDate: "2026-09-11", goalSeconds: 3600 }),
    ).toThrow();
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

describe("account and profile contracts", () => {
  it("limits display names to a layout-safe length", () => {
    const base = { timezone: "UTC", theme: "system" } as const;

    expect(
      profileSchema.safeParse({
        ...base,
        displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({
        ...base,
        displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid timezone", () => {
    expect(
      profileSchema.safeParse({
        displayName: "Ralph",
        timezone: "Moon/Base",
        theme: "system",
      }).success,
    ).toBe(false);
  });

  it("requires explicit deletion confirmation", () => {
    expect(
      accountOperationSchema.safeParse({
        operation: "delete",
        confirmation: "delete",
      }).success,
    ).toBe(true);
    expect(
      accountOperationSchema.safeParse({ operation: "delete" }).success,
    ).toBe(false);
  });
});
