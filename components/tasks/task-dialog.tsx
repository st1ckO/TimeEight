"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { GoalKind, Task } from "@/lib/domain/types";
import { taskSchema } from "@/lib/domain/schemas";

const colors = [
  { name: "Teal", value: "#197c67" },
  { name: "Blue", value: "#5577dc" },
  { name: "Amber", value: "#d58c33" },
  { name: "Purple", value: "#a45cc4" },
  { name: "Coral", value: "#d86464" },
  { name: "Sage", value: "#73966b" },
  { name: "Cyan", value: "#328ca3" },
  { name: "Indigo", value: "#7063bd" },
  { name: "Rose", value: "#c65b8c" },
  { name: "Terracotta", value: "#b96c4b" },
  { name: "Gold", value: "#b39535" },
  { name: "Slate", value: "#718096" },
];

function TaskForm({
  task,
  onSave,
  close,
}: {
  task?: Task;
  onSave(input: {
    name: string;
    goalKind: GoalKind;
    targetSeconds: number;
    color: string;
  }): Promise<void>;
  close(): void;
}) {
  const [name, setName] = useState(task?.name ?? "");
  const [goalKind, setGoalKind] = useState<GoalKind>(
    task?.goalKind ?? "minimum",
  );
  const [minutes, setMinutes] = useState(
    Math.round((task?.targetSeconds ?? 3600) / 60),
  );
  const [color, setColor] = useState(task?.color ?? colors[0]!.value);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = taskSchema.safeParse({
      name,
      goalKind,
      targetSeconds: minutes * 60,
      color,
    });
    if (!parsed.success)
      return setError(
        "Add a name and choose a target between 1 minute and 24 hours.",
      );
    await onSave(parsed.data);
    close();
  }

  return (
    <form className="dialog-form" onSubmit={submit}>
      <label>
        Task name
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="e.g. Practice guitar"
        />
      </label>
      <fieldset>
        <legend>Timer intention</legend>
        <div className="task-intention">
          <label>
            <input
              type="radio"
              name="kind"
              checked={goalKind === "minimum"}
              onChange={() => setGoalKind("minimum")}
            />
            <span>Build time</span>
          </label>
          <label>
            <input
              type="radio"
              name="kind"
              checked={goalKind === "limit"}
              onChange={() => setGoalKind("limit")}
            />
            <span>Limit time</span>
          </label>
        </div>
      </fieldset>
      <label>
        Daily target in minutes
        <input
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
      </label>
      <fieldset>
        <legend>Color</legend>
        <div className="color-options">
          {colors.map((option) => (
            <button
              type="button"
              key={option.value}
              className={color === option.value ? "selected" : ""}
              style={{ background: option.value }}
              onClick={() => setColor(option.value)}
              aria-label={`Use ${option.name.toLowerCase()} color`}
              aria-pressed={color === option.value}
              title={option.name}
            />
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button form-primary">
        {task ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  task?: Task;
  onSave(input: {
    name: string;
    goalKind: GoalKind;
    targetSeconds: number;
    color: string;
  }): Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content task-dialog"
          aria-describedby="task-description"
        >
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">Daily timer</p>
              <Dialog.Title>{task ? "Edit task" : "Add a task"}</Dialog.Title>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description
            id="task-description"
            className="task-description"
          >
            Choose whether this time is something to build up or gently limit.
          </Dialog.Description>
          {open && (
            <TaskForm
              key={task?.id ?? "new"}
              task={task}
              onSave={onSave}
              close={() => onOpenChange(false)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
