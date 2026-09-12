"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { GoalKind, Task } from "@/lib/domain/types";
import { taskSchema } from "@/lib/domain/schemas";
import { SavedTaskChoices } from "./saved-task-choices";
import { AnimatedHeight } from "@/components/ui/animated-height";
import { allotmentStopsTimer } from "@/lib/domain/task-targets";
import { formatDuration } from "@/lib/domain/time";

interface TodayEditor {
  localDate: string;
  targetSeconds: number;
  trackedSeconds: number;
  running: boolean;
}

interface TaskFormInput {
  name: string;
  goalKind: GoalKind;
  targetSeconds: number;
  color: string;
  useAsDefault?: boolean;
  confirmStop?: boolean;
}

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
  todayEditor,
}: {
  task?: Task;
  todayEditor?: TodayEditor;
  onSave(input: TaskFormInput): Promise<void>;
  close(): void;
}) {
  const [name, setName] = useState(task?.name ?? "");
  const [goalKind, setGoalKind] = useState<GoalKind>(
    task?.goalKind ?? "minimum",
  );
  const [minutes, setMinutes] = useState(
    Math.round(
      (todayEditor?.targetSeconds ?? task?.targetSeconds ?? 3600) / 60,
    ),
  );
  const [color, setColor] = useState(task?.color ?? colors[0]!.value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const needsStop =
    todayEditor &&
    allotmentStopsTimer(
      goalKind,
      minutes * 60,
      todayEditor.trackedSeconds,
      todayEditor.running,
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
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
    setPending(true);
    setError(null);
    try {
      if (needsStop && !confirmStop) {
        setError("Confirm stopping the timer before saving this allotment.");
        return;
      }
      await onSave({
        ...parsed.data,
        ...(todayEditor ? { useAsDefault, confirmStop } : {}),
      });
      close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't save this task. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const savedTaskFields = (
    <>
      <label>
        Task name
        <input
          autoFocus={!todayEditor}
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
      {!todayEditor && (
        <label>
          {task ? "Default daily target in minutes" : "Daily target in minutes"}
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
      )}
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
    </>
  );

  return (
    <form className="dialog-form" onSubmit={submit}>
      {todayEditor && (
        <fieldset className="today-allotment-fields">
          <legend>Today’s allotment</legend>
          <p className="form-hint">
            Only for today ({todayEditor.localDate}). Tomorrow uses the task
            default:{" "}
            {formatDuration(
              useAsDefault ? minutes * 60 : (task?.targetSeconds ?? 3600),
            )}
            .
          </p>
          <div className="allotment-duration">
            <label>
              Hours
              <input
                type="number"
                autoFocus
                min={0}
                max={24}
                value={Math.floor(minutes / 60)}
                onChange={(event) => {
                  setMinutes(Number(event.target.value) * 60 + (minutes % 60));
                  setConfirmStop(false);
                }}
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                value={minutes % 60}
                onChange={(event) => {
                  setMinutes(
                    Math.floor(minutes / 60) * 60 + Number(event.target.value),
                  );
                  setConfirmStop(false);
                }}
              />
            </label>
          </div>
          <div className="allotment-shortcuts">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setMinutes(Math.max(1, minutes - 15));
                setConfirmStop(false);
              }}
            >
              −15 min
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setMinutes(Math.min(1440, minutes + 15));
                setConfirmStop(false);
              }}
            >
              +15 min
            </button>
            {task && minutes * 60 !== task.targetSeconds && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setMinutes(task.targetSeconds / 60);
                  setUseAsDefault(false);
                  setConfirmStop(false);
                }}
              >
                Reset to default
              </button>
            )}
          </div>
          <label className="allotment-check">
            <input
              type="checkbox"
              checked={useAsDefault}
              onChange={(event) => setUseAsDefault(event.target.checked)}
            />
            <span>Use as task default too</span>
          </label>
          {needsStop && (
            <label className="allotment-check">
              <input
                type="checkbox"
                checked={confirmStop}
                onChange={(event) => setConfirmStop(event.target.checked)}
              />
              <span>
                This limit is already reached. Stop the running timer and save
                its tracked time.
              </span>
            </label>
          )}
        </fieldset>
      )}
      {todayEditor ? (
        <details className="saved-task-settings">
          <summary>Saved-task settings</summary>
          <p className="form-hint">
            Name, intention, and color apply everywhere.
          </p>
          <div className="dialog-form">{savedTaskFields}</div>
        </details>
      ) : (
        savedTaskFields
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button form-primary" disabled={pending}>
        {pending ? "Saving…" : task ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
  savedTasks,
  onSelect,
  todayEditor,
  savedTargets,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  task?: Task;
  savedTasks?: Task[];
  savedTargets?: Record<string, number>;
  todayEditor?: TodayEditor;
  onSelect?(id: string, targetSeconds?: number): Promise<void>;
  onSave(input: TaskFormInput): Promise<void>;
}) {
  const [source, setSource] = useState<"new" | "saved">("new");
  const canChoose = !task && savedTasks !== undefined && onSelect !== undefined;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setSource("new");
        onOpenChange(next);
      }}
    >
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
            {todayEditor
              ? "Adjust today’s time without changing your tracked history."
              : task
                ? "Change saved defaults. Today’s chosen allotment and past targets are kept."
                : "Choose whether this time is something to build up or gently limit."}
          </Dialog.Description>
          {open && (
            <AnimatedHeight className="task-dialog-body">
              {canChoose && (
                <div
                  className="task-source-options"
                  role="group"
                  aria-label="Task source"
                >
                  <button
                    type="button"
                    aria-pressed={source === "new"}
                    onClick={() => setSource("new")}
                  >
                    New task
                  </button>
                  <button
                    type="button"
                    aria-pressed={source === "saved"}
                    onClick={() => setSource("saved")}
                  >
                    From task list
                  </button>
                </div>
              )}
              <div hidden={canChoose && source === "saved"}>
                <TaskForm
                  key={`${task?.id ?? "new"}:${todayEditor?.localDate ?? "default"}`}
                  task={task}
                  todayEditor={todayEditor}
                  onSave={onSave}
                  close={() => {
                    setSource("new");
                    onOpenChange(false);
                  }}
                />
              </div>
              {canChoose && source === "saved" && (
                <SavedTaskChoices
                  tasks={savedTasks}
                  targets={savedTargets}
                  onSelect={async (id, targetSeconds) => {
                    if (targetSeconds === undefined) await onSelect(id);
                    else await onSelect(id, targetSeconds);
                    setSource("new");
                    onOpenChange(false);
                  }}
                />
              )}
            </AnimatedHeight>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
