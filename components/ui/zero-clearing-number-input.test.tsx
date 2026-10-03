import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ZeroClearingNumberInput } from "./zero-clearing-number-input";

function Example() {
  const [value, setValue] = useState(0);
  return (
    <label>
      Minutes
      <ZeroClearingNumberInput value={value} onValueChange={setValue} />
    </label>
  );
}

describe("ZeroClearingNumberInput", () => {
  it("lets the first typed number replace a displayed zero", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByLabelText("Minutes");

    expect(input).toHaveValue(0);
    await user.click(input);
    expect(input).toHaveValue(null);
    await user.type(input, "12");
    expect(input).toHaveValue(12);
    await user.tab();
    expect(input).toHaveValue(12);
  });

  it("restores zero when an empty field loses focus", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByLabelText("Minutes");

    await user.click(input);
    expect(input).toHaveValue(null);
    await user.tab();
    expect(input).toHaveValue(0);
  });
});
