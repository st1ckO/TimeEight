import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmTaskAction } from "./confirm-task-action";

describe("task removal confirmation", () => {
  it("focuses cancel and never removes on cancellation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmTaskAction
        open
        title="Remove Reading?"
        description="Saved time stays."
        confirmLabel="Remove task"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves the confirmation open and reports failed saves", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("failed"));
    const onOpenChange = vi.fn();
    render(
      <ConfirmTaskAction
        open
        title="Archive Reading?"
        description="Saved time stays."
        confirmLabel="Archive task"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Archive task" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't save this change",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
