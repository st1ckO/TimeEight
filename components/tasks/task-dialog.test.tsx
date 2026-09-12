import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskDialog } from "./task-dialog";

describe("TaskDialog", () => {
  it("offers twelve named colors and saves the chosen intention and color", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<TaskDialog open onOpenChange={onOpenChange} onSave={onSave} />);

    expect(screen.getByRole("radio", { name: "Build time" })).toBeChecked();
    expect(
      screen.getAllByRole("button", { name: /^Use .* color$/ }),
    ).toHaveLength(12);
    expect(
      screen.getByRole("button", { name: "Use teal color" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByLabelText("Task name"), "Read a book");
    await user.click(screen.getByRole("radio", { name: "Limit time" }));
    await user.click(screen.getByRole("button", { name: "Use rose color" }));
    expect(
      screen.getByRole("button", { name: "Use teal color" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Use rose color" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Read a book",
      goalKind: "limit",
      targetSeconds: 3600,
      color: "#c65b8c",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps invalid input in the dialog rather than saving it", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TaskDialog open onOpenChange={vi.fn()} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a name");
    expect(onSave).not.toHaveBeenCalled();
  });
});
