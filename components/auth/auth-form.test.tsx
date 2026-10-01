import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

describe("AuthForm", () => {
  it("introduces the product before the account controls", () => {
    const { container } = render(
      <AuthForm configured emailEnabled={false} turnstileSiteKey="" />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /start a timer.*understand your day/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/calm, intentional time tracking/i),
    ).not.toBeInTheDocument();
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
      screen.getByRole("heading", { name: /see your patterns/i }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("Good morning, Alex.");
    expect(container).toHaveTextContent("Walking");
    expect(container).toHaveTextContent("Reading");
    expect(container).toHaveTextContent("Social media");
    expect(container).toHaveTextContent("Limit time");
  });

  it("keeps production email auth and setup copy hidden until SMTP is enabled", () => {
    render(<AuthForm configured emailEnabled={false} turnstileSiteKey="" />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secure mail delivery/i)).not.toBeInTheDocument();
  });

  it("asks Google to show the account chooser", async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: null });
    render(<AuthForm configured emailEnabled={false} turnstileSiteKey="" />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
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
      screen.queryByRole("link", { name: /local demo/i }),
    ).not.toBeInTheDocument();
  });
});
