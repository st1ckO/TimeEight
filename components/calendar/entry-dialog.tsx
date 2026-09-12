"use client";

import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";
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
  const taskLabelId = useId();
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
      <div className="entry-task-field">
        <span id={taskLabelId}>Task</span>
        <Select.Root value={taskId} onValueChange={setTaskId}>
          <Select.Trigger
            className="entry-task-trigger"
            aria-labelledby={taskLabelId}
          >
            <Select.Value placeholder="Choose a task" />
            <Select.Icon>
              <ChevronDown size={18} aria-hidden />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              className="entry-task-menu"
              position="popper"
              align="start"
              sideOffset={6}
              collisionPadding={14}
            >
              <Select.Viewport>
                {tasks.map((task) => (
                  <Select.Item
                    className="entry-task-option"
                    value={task.id}
                    key={task.id}
                  >
                    <Select.ItemText>
                      {task.name}
                      {task.archivedAt ? " (archived)" : ""}
                    </Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={16} aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
      <label>
        Date
        <input
          type="date"
          value={localDate}
          onChange={(event) => setLocalDate(event.target.value)}
          required
        />
      </label>
      <fieldset aria-label="Duration">
        <div className="duration-fields">
          <label>
            Duration (hours)
            <input
              type="number"
              min={0}
              max={24}
              aria-label="Hours"
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
        Added or corrected time counts toward daily totals, but not the
        three-hour streak.
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
        <Dialog.Content className="dialog-content entry-dialog">
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
          <Dialog.Description className="entry-description">
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
