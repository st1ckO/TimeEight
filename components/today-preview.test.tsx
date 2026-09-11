import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodayPreview } from "./today-preview";

describe("TodayPreview", () => {
  it("puts the daily goal and timer controls in the main working surface", () => {
    render(<TodayPreview />);

    expect(
      screen.getByRole("heading", { name: /good afternoon/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /36% of daily goal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start morning walk/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pause portfolio project/i }),
    ).toBeInTheDocument();
  });
});
