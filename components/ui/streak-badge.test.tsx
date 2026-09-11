import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreakBadge } from "./streak-badge";

describe("StreakBadge", () => {
  it("shows a completed tier and explains eligible time", () => {
    render(
      <StreakBadge days={30} todaySeconds={10_800} saverAvailable={true} />,
    );

    const badge = screen.getByRole("button", {
      name: /30-day streak, protected today/i,
    });
    expect(badge).toHaveTextContent("30 d");
    expect(badge).toHaveClass("is-complete", "streak-coral");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Manual and corrected entries do not count",
    );
  });

  it("uses the muted pending state until three timer hours are reached", () => {
    render(
      <StreakBadge days={4} todaySeconds={3_600} saverAvailable={false} />,
    );

    const badge = screen.getByRole("button", {
      name: /4-day streak, 2h 0m left today/i,
    });
    expect(badge).toHaveClass("is-pending");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "An unfinished day resets the streak",
    );
  });
});
