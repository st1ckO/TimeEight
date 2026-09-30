import { describe, expect, it } from "vitest";
import { shouldSeedExampleTasks } from "./onboarding";

describe("shouldSeedExampleTasks", () => {
  it("seeds an incomplete account with no tasks", () => {
    expect(shouldSeedExampleTasks({ onboardingCompleted: false }, 0)).toBe(
      true,
    );
  });

  it("preserves an intentionally empty completed account", () => {
    expect(shouldSeedExampleTasks({ onboardingCompleted: true }, 0)).toBe(
      false,
    );
  });

  it("does not duplicate tasks already loaded for an incomplete account", () => {
    expect(shouldSeedExampleTasks({ onboardingCompleted: false }, 1)).toBe(
      false,
    );
  });
});
