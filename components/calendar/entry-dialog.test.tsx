import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Task, TimeEntry } from "@/lib/domain/types";
import { EntryDialog } from "./entry-dialog";

const task: Task = {
  id: "task-1",
  userId: "user-1",
  name: "Focus time",
  color: "#197c67",
  goalKind: "minimum",
  targetSeconds: 3_600,
  sortOrder: 0,
  archivedAt: null,
  onDailyList: true,
};

const entry: TimeEntry = {
  id: "entry-1",
  userId: "user-1",
  taskId: task.id,
  localDate: "2026-10-03",
  durationSeconds: 3_600,
  source: "manual",
  startedAt: null,
  endedAt: null,
  manuallyAdjusted: true,
  correctionOriginalTaskId: null,
  correctionOriginalLocalDate: null,
  correctionOriginalDurationSeconds: null,
  mutationId: "mutation-1",
};

describe("EntryDialog duration inputs", () => {
  it("replaces zero hours when adding time", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EntryDialog
        open
        onOpenChange={vi.fn()}
        date="2026-10-03"
        tasks={[task]}
        onSave={onSave}
      />,
    );
    const hours = screen.getByLabelText("Hours");

    expect(hours).toHaveValue(0);
    await user.click(hours);
    expect(hours).toHaveValue(null);
    await user.type(hours, "1");
    await user.click(screen.getByRole("button", { name: "Add time" }));

    expect(onSave).toHaveBeenCalledWith({
      taskId: task.id,
      localDate: "2026-10-03",
      durationSeconds: 5_400,
    });
  });

  it("replaces zero minutes when correcting time", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EntryDialog
        open
        onOpenChange={vi.fn()}
        date="2026-10-03"
        tasks={[task]}
        entry={entry}
        onSave={onSave}
      />,
    );
    const minutes = screen.getByLabelText("Minutes");

    expect(minutes).toHaveValue(0);
    await user.click(minutes);
    expect(minutes).toHaveValue(null);
    await user.type(minutes, "15");
    await user.click(screen.getByRole("button", { name: "Save correction" }));

    expect(onSave).toHaveBeenCalledWith({
      taskId: task.id,
      localDate: "2026-10-03",
      durationSeconds: 4_500,
    });
  });

  it("submits added time only once while saving", async () => {
    let finishSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const onOpenChange = vi.fn();
    render(
      <EntryDialog
        open
        onOpenChange={onOpenChange}
        date="2026-10-03"
        tasks={[task]}
        onSave={onSave}
      />,
    );
    const button = screen.getByRole("button", { name: "Add time" });
    const form = button.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(form).toHaveAttribute("aria-busy", "true");

    finishSave?.();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("allows another attempt after a save failure", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    render(
      <EntryDialog
        open
        onOpenChange={vi.fn()}
        date="2026-10-03"
        tasks={[task]}
        onSave={onSave}
      />,
    );
    const button = screen.getByRole("button", { name: "Add time" });

    await user.click(button);
    expect(
      await screen.findByText("Time could not be saved. Please try again."),
    ).toBeVisible();
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
