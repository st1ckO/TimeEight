import { describe, expect, it, vi } from "vitest";
import {
  OnboardingSaveTimeoutError,
  waitForOnboardingSave,
} from "./onboarding-completion";

describe("waitForOnboardingSave", () => {
  it("returns a completed save result", async () => {
    await expect(
      waitForOnboardingSave(Promise.resolve("saved"), 50),
    ).resolves.toBe("saved");
  });

  it("stops waiting when a save does not settle", async () => {
    vi.useFakeTimers();
    try {
      const result = waitForOnboardingSave(new Promise(() => undefined), 50);
      const rejection = expect(result).rejects.toBeInstanceOf(
        OnboardingSaveTimeoutError,
      );

      await vi.advanceTimersByTimeAsync(50);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
