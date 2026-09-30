import { describe, expect, it } from "vitest";
import { onboardingRedirect } from "./onboarding-routing";

describe("onboardingRedirect", () => {
  it("requires onboarding before an incomplete account enters the app", () => {
    for (const path of ["/today", "/calendar", "/insights", "/settings"]) {
      expect(onboardingRedirect(path, false)).toBe("/onboarding");
    }
  });

  it("allows an incomplete account to use onboarding", () => {
    expect(onboardingRedirect("/onboarding", false)).toBeNull();
  });

  it("keeps a completed account out of onboarding", () => {
    expect(onboardingRedirect("/onboarding", true)).toBe("/today");
  });

  it("sends authenticated accounts from login to the right destination", () => {
    expect(onboardingRedirect("/login", false)).toBe("/onboarding");
    expect(onboardingRedirect("/login", true)).toBe("/today");
  });
});
