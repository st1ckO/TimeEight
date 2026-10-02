import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeEight } from "@/components/app/app-provider";
import { ONBOARDING_SAVE_TIMEOUT_MS } from "@/lib/auth/onboarding-completion";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/domain/profile";
import { OnboardingForm } from "./onboarding-form";

const replace = vi.fn();
const refresh = vi.fn();
const completeOnboarding = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("@/components/app/app-provider", () => ({
  useTimeEight: vi.fn(),
}));

describe("OnboardingForm", () => {
  beforeEach(() => {
    replace.mockClear();
    refresh.mockClear();
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
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(/Saving your setup/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Setup saved/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open my day" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Open my day" })).toBeDisabled();
  });

  it("exposes the display-name length limit", () => {
    render(<OnboardingForm />);

    expect(screen.getByPlaceholderText("Your name")).toHaveAttribute(
      "maxlength",
      String(DISPLAY_NAME_MAX_LENGTH),
    );
    expect(
      screen.getByText(`Up to ${DISPLAY_NAME_MAX_LENGTH} characters.`),
    ).toBeVisible();
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

  it("offers a recovery route when saving does not settle", async () => {
    vi.useFakeTimers();
    try {
      completeOnboarding.mockReturnValueOnce(new Promise(() => undefined));
      render(<OnboardingForm />);

      fireEvent.click(screen.getByRole("button", { name: "Open my day" }));
      expect(screen.queryByText(/Saving your setup/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open my day" }),
      ).toHaveAttribute("aria-busy", "true");
      expect(
        document.querySelector(".onboarding-submit-spinner"),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(ONBOARDING_SAVE_TIMEOUT_MS);
      });

      expect(
        screen.getByRole("button", { name: "Open my day" }),
      ).toHaveAttribute("aria-busy", "false");
      expect(
        document.querySelector(".onboarding-submit-spinner"),
      ).not.toBeInTheDocument();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your setup may already be saved.",
      );
      expect(screen.getByRole("button", { name: "Open Today" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Open my day" })).toBeEnabled();
      expect(replace).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
