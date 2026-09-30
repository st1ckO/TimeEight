import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeEight } from "@/components/app/app-provider";
import { OnboardingForm } from "./onboarding-form";

const replace = vi.fn();
const completeOnboarding = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/components/app/app-provider", () => ({
  useTimeEight: vi.fn(),
}));

describe("OnboardingForm", () => {
  beforeEach(() => {
    replace.mockClear();
    completeOnboarding.mockReset();
    vi.mocked(useTimeEight).mockReturnValue({
      profile: {
        displayName: "Ralph",
        timezone: "UTC",
        theme: "system",
      },
      hydrated: true,
      tasks: [],
      completeOnboarding,
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

  it("keeps the example timers when the default choice is checked", async () => {
    render(<OnboardingForm />);

    await userEvent.click(screen.getByRole("button", { name: "Open my day" }));

    expect(completeOnboarding).toHaveBeenCalledWith(
      {
        displayName: "Ralph",
        theme: "system",
        timezone: "Asia/Manila",
      },
      true,
    );
    expect(replace).toHaveBeenCalledWith("/today");
  });

  it("passes the user's choice to remove the example timers", async () => {
    render(<OnboardingForm />);
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /keep three editable example timers/i,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Open my day" }));

    expect(completeOnboarding).toHaveBeenCalledWith(expect.any(Object), false);
  });

  it("keeps onboarding open when completion cannot be synchronized", async () => {
    completeOnboarding.mockRejectedValueOnce(
      new Error("Connect to the internet to finish setup."),
    );
    render(<OnboardingForm />);

    await userEvent.click(screen.getByRole("button", { name: "Open my day" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connect to the internet to finish setup.",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
