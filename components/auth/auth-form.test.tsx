import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AuthForm", () => {
  it("introduces the product before the account controls", () => {
    render(<AuthForm configured emailEnabled={false} turnstileSiteKey="" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /understand your time without judging your day/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /preview of the TimeEight Today dashboard/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /timers with intention/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /your time in context/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /patterns without scores/i }),
    ).toBeInTheDocument();
  });

  it("keeps production email auth hidden until SMTP is enabled", () => {
    render(<AuthForm configured emailEnabled={false} turnstileSiteKey="" />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/secure mail delivery/i)).toBeInTheDocument();
  });

  it("explains how to enable sign-in when the backend is not configured", async () => {
    render(
      <AuthForm configured={false} emailEnabled={false} turnstileSiteKey="" />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/\.env\.local/i);
    expect(
      screen.getByRole("link", { name: /explore the local demo/i }),
    ).toHaveAttribute("href", "/today");
  });
});
