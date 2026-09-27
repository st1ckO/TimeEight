import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("legacy automatic timer pause route", () => {
  it("refuses to delete timers without an explicit recovery choice", async () => {
    const response = POST();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error:
        "Automatic timer pausing is disabled. Resolve the timer from the recovery prompt.",
    });
  });
});
