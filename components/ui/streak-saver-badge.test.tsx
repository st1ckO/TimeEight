import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreakSaverBadge } from "./streak-saver-badge";

describe("StreakSaverBadge", () => {
  it("shows an available shield and explains weekly protection", () => {
    render(
      <StreakSaverBadge
        available={true}
        consumedDate={null}
        today="2026-09-11"
        timezone="Asia/Manila"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Weekly streak saver available. Show saver rules",
      }),
    ).toHaveClass("is-available");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Unused protection renews Monday, Sep 14 at 12:00 AM (Asia/Manila).",
    );
  });

  it("grays out a used shield and gives the reset time", () => {
    render(
      <StreakSaverBadge
        available={false}
        consumedDate="2026-09-09"
        today="2026-09-11"
        timezone="Asia/Manila"
      />,
    );

    const badge = screen.getByRole("button", {
      name: /weekly streak saver used.*monday, sep 14 at 12:00 am/i,
    });
    expect(badge).toHaveClass("is-used");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Used Wednesday, Sep 9. Resets Monday, Sep 14 at 12:00 AM (Asia/Manila).",
    );
  });
});
