"use client";

import { useState } from "react";
import type { Task } from "@/lib/domain/types";
import { formatDuration } from "@/lib/domain/time";

export function SavedTaskChoices({
  tasks,
  onSelect,
}: {
  tasks: Task[];
  onSelect(id: string): Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = tasks.filter((task) => !task.archivedAt);
  const matching = saved.filter((task) =>
    task.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function select(id: string) {
    setPending(id);
    setError(null);
    try {
      await onSelect(id);
    } catch {
      setError("Couldn't add this task. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="dialog-form">
      <label>
        Find a saved task
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your tasks"
          maxLength={80}
        />
      </label>
      <p className="form-hint">
        Reuse a task without losing its tracked time. Archived tasks can be
        restored from Task list.
      </p>
      <ul className="saved-task-list">
        {matching.map((task) => (
          <li key={task.id} className="saved-task-row">
            <span
              className="saved-task-dot"
              style={{ background: task.color }}
              aria-hidden
            />
            <div className="saved-task-copy">
              <h3>{task.name}</h3>
              <p>
                {task.goalKind === "minimum" ? "Build time" : "Limit time"} ·{" "}
                {formatDuration(task.targetSeconds)}
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={task.onDailyList || pending !== null}
              aria-label={
                task.onDailyList
                  ? `${task.name} is already on your daily list`
                  : `Add ${task.name} to daily list`
              }
              onClick={() => void select(task.id)}
            >
              {task.onDailyList
                ? "Added"
                : pending === task.id
                  ? "Adding…"
                  : "Add"}
            </button>
          </li>
        ))}
      </ul>
      {matching.length === 0 && (
        <p className="form-hint">
          {saved.length === 0
            ? "No saved tasks yet. Create a new task to get started."
            : "No tasks match your search."}
        </p>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
