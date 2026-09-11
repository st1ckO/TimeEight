"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { Task, TimeEntry } from "@/lib/domain/types";

function EntryForm({
  date,
  tasks,
  entry,
  onSave,
  close,
}: {
  date: string;
  tasks: Task[];
  entry?: TimeEntry;
  onSave(input: {
    taskId: string;
    localDate: string;
    durationSeconds: number;
  }): Promise<void>;
  close(): void;
}) {
  const initialMinutes = Math.max(
    1,
    Math.round((entry?.durationSeconds ?? 1800) / 60),
  );
  const [taskId, setTaskId] = useState(entry?.taskId ?? tasks[0]?.id ?? "");
  const [localDate, setLocalDate] = useState(entry?.localDate ?? date);
  const [hours, setHours] = useState(Math.floor(initialMinutes / 60));
  const [minutes, setMinutes] = useState(initialMinutes % 60);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const durationSeconds = (hours * 60 + minutes) * 60;
    if (!taskId || durationSeconds < 60 || durationSeconds > 86_400) {
      return setError(
        "Choose a task and a duration between 1 minute and 24 hours.",
      );
    }
    await onSave({ taskId, localDate, durationSeconds });
    close();
  }

  return (
    <form className="dialog-form" onSubmit={submit}>
      <label>
        Task
        <select
          value={taskId}
          onChange={(event) => setTaskId(event.target.value)}
        >
          {tasks.map((task) => (
            <option value={task.id} key={task.id}>
              {task.name}
              {task.archivedAt ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input
          type="date"
          value={localDate}
          onChange={(event) => setLocalDate(event.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend>Duration</legend>
        <div className="duration-fields">
          <label>
            Hours
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
            />
          </label>
          <label>
            Minutes
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
        </div>
      </fieldset>
      <p className="form-hint">
        Corrections are duration-based. They do not create a scheduled time
        block.
      </p>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button form-primary">
        {entry ? "Save correction" : "Add time"}
      </button>
    </form>
  );
}

export function EntryDialog({
  open,
  onOpenChange,
  date,
  tasks,
  entry,
  onSave,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  date: string;
  tasks: Task[];
  entry?: TimeEntry;
  onSave(input: {
    taskId: string;
    localDate: string;
    durationSeconds: number;
  }): Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">Time history</p>
              <Dialog.Title>
                {entry ? "Correct an entry" : "Add tracked time"}
              </Dialog.Title>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description>
            Record how long you spent, without assigning a start or end time.
          </Dialog.Description>
          {open && (
            <EntryForm
              key={entry?.id ?? `new-${date}`}
              date={date}
              tasks={tasks}
              entry={entry}
              onSave={onSave}
              close={() => onOpenChange(false)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
