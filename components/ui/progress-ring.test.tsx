import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./progress-ring";

describe("ProgressRing", () => {
  it("exposes a text alternative and caps visual progress", () => {
    render(<ProgressRing value={140} label="7 hours tracked of 5 hour goal" />);
    const ring = screen.getByRole("img", {
      name: "7 hours tracked of 5 hour goal",
    });
    const progressCircle = ring.querySelector(".ring-value");
    expect(progressCircle).toHaveAttribute("stroke-dashoffset", "0");
  });
});
