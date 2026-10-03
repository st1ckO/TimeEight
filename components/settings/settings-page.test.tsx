import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/app/app-provider", () => ({
  useTimeEight: () => ({
    userId: "user-1",
    hydrated: true,
    now: Date.UTC(2026, 9, 3),
    today: "2026-10-03",
    profile: {
      id: "user-1",
      displayName: "Ralph",
      timezone: "Asia/Manila",
      theme: "system",
      onboardingCompleted: true,
      accountStart: "2026-01-01",
    },
    tasks: [],
    taskDailyTargets: [],
    entries: [],
    updateProfile: vi.fn(),
    pauseAll: vi.fn(),
    clearUserData: vi.fn(),
    restoreBackup: vi.fn(),
  }),
}));

describe("SettingsPage", () => {
  it("shows the Google email above the display name", () => {
    render(<SettingsPage accountEmail="person@example.com" />);

    const accountLabel = screen.getByText("Signed in with Google");
    const accountEmail = screen.getByText("person@example.com");
    const displayName = screen.getByLabelText("Display name");

    expect(accountLabel).toBeInTheDocument();
    expect(accountEmail).toBeInTheDocument();
    expect(accountEmail.closest("form")).toBe(displayName.closest("form"));
    expect(
      accountEmail.compareDocumentPosition(displayName) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
