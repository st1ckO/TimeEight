"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import type { Task } from "@/lib/domain/types";
import { formatDuration } from "@/lib/domain/time";
import { AnimatedHeight } from "@/components/ui/animated-height";
import { ConfirmTaskAction } from "./confirm-task-action";
import { TaskDialog } from "./task-dialog";

export function TaskLibraryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const app = useTimeEight();
  const [view, setView] = useState<"saved" | "archived">("saved");
  const [search, setSearch] = useState("");
  const [archiving, setArchiving] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matching = app.tasks.filter(
    (task) =>
      Boolean(task.archivedAt) === (view === "archived") &&
      task.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function restore(task: Task) {
    setPending(task.id);
    setError(null);
    try {
      await app.restoreTask(task.id);
    } catch {
      setError("Couldn't restore this task. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content task-dialog">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Reusable tasks</p>
                <Dialog.Title>Task list</Dialog.Title>
              </div>
              <Dialog.Close
                className="icon-button"
                aria-label="Close task list"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="task-description">
              Keep tasks here for any day. Archiving keeps their history;
              restore them whenever you need them.
            </Dialog.Description>
            <AnimatedHeight className="task-library-body">
              <div className="dialog-form">
                <div
                  className="task-source-options"
                  role="group"
                  aria-label="Task list view"
                >
                  <button
                    type="button"
                    aria-pressed={view === "saved"}
                    onClick={() => setView("saved")}
                  >
                    Saved
                  </button>
                  <button
                    type="button"
                    aria-pressed={view === "archived"}
                    onClick={() => setView("archived")}
                  >
                    Archived
                  </button>
                </div>
                <label>
                  Find a task
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search your tasks"
                    maxLength={80}
                  />
                </label>
                <ul className="saved-task-list">
                  {matching.map((task) => (
                    <li
                      key={task.id}
                      className="saved-task-row library-task-row"
                    >
                      <span
                        className="saved-task-dot"
                        style={{ background: task.color }}
                        aria-hidden
                      />
                      <div className="saved-task-copy">
                        <h3>{task.name}</h3>
                        <p>
                          {task.goalKind === "minimum"
                            ? "Build time"
                            : "Limit time"}{" "}
                          · {formatDuration(task.targetSeconds)}
                          {task.onDailyList ? " · On daily list" : ""}
                        </p>
                      </div>
                      <div className="saved-task-actions">
                        {view === "archived" ? (
                          <button
                            className="secondary-button"
                            disabled={pending !== null}
                            aria-label={`Restore ${task.name}`}
                            onClick={() => void restore(task)}
                          >
                            {pending === task.id ? "Restoring…" : "Restore"}
                          </button>
                        ) : (
                          <>
                            <button
                              className="secondary-button"
                              aria-label={`Edit saved task ${task.name}`}
                              onClick={() => setEditing(task)}
                            >
                              Edit
                            </button>
                            <button
                              className="secondary-button"
                              aria-label={`Archive ${task.name}`}
                              onClick={() => setArchiving(task)}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {matching.length === 0 && (
                  <p className="form-hint">
                    {search.trim()
                      ? "No tasks match your search."
                      : view === "archived"
                        ? "No archived tasks."
                        : "No saved tasks. Add a new task from Today."}
                  </p>
                )}
                {view === "archived" && (
                  <p className="form-hint">
                    Restoring returns a task to Saved. Choose it from Add task
                    when you want it on your daily list.
                  </p>
                )}
                {error && (
                  <p className="form-message" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </AnimatedHeight>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <TaskDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        task={editing ?? undefined}
        onSave={(input) =>
          editing ? app.updateTask(editing.id, input) : Promise.resolve()
        }
      />
      <ConfirmTaskAction
        open={archiving !== null}
        onOpenChange={(next) => {
          if (!next) setArchiving(null);
        }}
        title={`Archive ${archiving?.name ?? "task"}?`}
        description="This removes the task from your daily list and moves it to Archived. Its tracked history is kept. Any running timer will stop and its elapsed time will be saved."
        confirmLabel="Archive task"
        onConfirm={async () => {
          if (archiving) await app.archiveTask(archiving.id);
        }}
      />
    </>
  );
}
