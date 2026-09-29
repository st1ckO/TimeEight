import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeEight } from "@/components/app/app-provider";
import { OnboardingForm } from "./onboarding-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/app/app-provider", () => ({
  useTimeEight: vi.fn(),
}));

describe("OnboardingForm timezone detection", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(useTimeEight).mockReturnValue({
      profile: {
        displayName: "Ralph",
        timezone: "UTC",
        theme: "system",
      },
      tasks: [],
      updateProfile: vi.fn(),
      archiveTask: vi.fn(),
    } as unknown as ReturnType<typeof useTimeEight>);
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Manila",
    });
  });

  it("keeps the server render deterministic, then applies the browser timezone", async () => {
    const serverHtml = renderToString(<OnboardingForm />);
    expect(serverHtml).toContain("Detected as <!-- -->UTC");
    expect(serverHtml).not.toContain("Detected as <!-- -->Asia/Manila");

    render(<OnboardingForm />);
    expect(await screen.findByText(/Detected as Asia\/Manila/)).toBeVisible();
    expect(screen.getByRole("combobox", { name: /Your timezone/ })).toHaveValue(
      "Asia/Manila",
    );
  });
});
