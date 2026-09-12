import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskDialog } from "./task-dialog";
import type { Task } from "@/lib/domain/types";

describe("TaskDialog", () => {
  const task: Task = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "user-1",
    name: "Reading",
    color: "#197c67",
    goalKind: "limit",
    targetSeconds: 3600,
    sortOrder: 0,
    archivedAt: null,
    onDailyList: true,
  };

  it("edits today only by default and can reset or also change the default", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDialog
        open
        task={task}
        todayEditor={{
          localDate: "2026-09-12",
          targetSeconds: 1200,
          trackedSeconds: 0,
          running: false,
        }}
        onSave={onSave}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Minutes")).toHaveValue(20);
    expect(
      screen.getByText(
        "Only for today (2026-09-12). Tomorrow uses the task default: 1h 0m.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Use as task default too")).not.toBeChecked();
    expect(
      screen.getByText("Saved-task settings").closest("details"),
    ).not.toHaveAttribute("open");
    await user.click(screen.getByText("Saved-task settings"));
    expect(screen.getByLabelText("Task name")).toHaveValue("Reading");
    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByLabelText("Hours")).toHaveValue(1);
    await user.click(screen.getByRole("button", { name: "−15 min" }));
    await user.click(screen.getByLabelText("Use as task default too"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ targetSeconds: 2700, useAsDefault: true }),
    );
  });

  it("requires explicit consent before saving a reached running limit", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDialog
        open
        task={task}
        todayEditor={{
          localDate: "2026-09-12",
          targetSeconds: 600,
          trackedSeconds: 900,
          running: true,
        }}
        onSave={onSave}
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("checkbox", { name: /Stop the running timer/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSeconds: 600,
        confirmStop: true,
        useAsDefault: false,
      }),
    );
  });

  it("can adjust a saved task before adding without editing its default", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDialog
        open
        savedTasks={[{ ...task, onDailyList: false }]}
        onSelect={onSelect}
        onSave={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "From task list" }));
    await user.click(
      screen.getByRole("button", { name: "Adjust allotment for Reading" }),
    );
    await user.clear(screen.getByLabelText("Today’s allotment in minutes"));
    await user.type(
      screen.getByLabelText("Today’s allotment in minutes"),
      "20",
    );
    await user.click(
      screen.getByRole("button", { name: "Add Reading to daily list" }),
    );
    expect(onSelect).toHaveBeenCalledWith(task.id, 1200);
    expect(task.targetSeconds).toBe(3600);
  });
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

  it("preserves a new-task draft while choosing from saved tasks", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const saved: Task = {
      id: "task-1",
      userId: "user-1",
      name: "Reading",
      color: "#197c67",
      goalKind: "minimum",
      targetSeconds: 3600,
      sortOrder: 0,
      archivedAt: null,
      onDailyList: false,
    };
    render(
      <TaskDialog
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        savedTasks={[
          saved,
          { ...saved, id: "task-2", name: "Walking", onDailyList: true },
          {
            ...saved,
            id: "task-3",
            name: "Old task",
            archivedAt: "2026-09-12T01:00:00.000Z",
          },
        ]}
        onSelect={onSelect}
      />,
    );
    await user.type(screen.getByLabelText("Task name"), "A draft");
    await user.click(screen.getByRole("button", { name: "From task list" }));
    expect(
      screen.getByRole("button", {
        name: "Walking is already on your daily list",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("heading", { name: "Old task" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Find a saved task"), "no match");
    expect(screen.getByText("No tasks match your search.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New task" }));
    expect(screen.getByLabelText("Task name")).toHaveValue("A draft");
    await user.click(screen.getByRole("button", { name: "From task list" }));
    await user.click(
      screen.getByRole("button", { name: "Add Reading to daily list" }),
    );
    expect(onSelect).toHaveBeenCalledWith("task-1");
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
