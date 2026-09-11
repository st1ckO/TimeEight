import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AuthForm", () => {
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
