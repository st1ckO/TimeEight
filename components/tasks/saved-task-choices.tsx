"use client";

import { useState } from "react";
import type { Task } from "@/lib/domain/types";
import { formatDuration } from "@/lib/domain/time";
import { taskDailyTargetSchema } from "@/lib/domain/schemas";

export function SavedTaskChoices({
  tasks,
  onSelect,
  targets,
}: {
  tasks: Task[];
  targets?: Record<string, number>;
  onSelect(id: string, targetSeconds?: number): Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const saved = tasks.filter((task) => !task.archivedAt);
  const matching = saved.filter((task) =>
    task.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function select(id: string) {
    if (
      adjusting === id &&
      !taskDailyTargetSchema.shape.targetSeconds.safeParse(minutes * 60).success
    ) {
      setError("Choose an allotment between 1 minute and 24 hours.");
      return;
    }
    setPending(id);
    setError(null);
    try {
      if (adjusting === id) await onSelect(id, minutes * 60);
      else await onSelect(id);
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
          <li
            key={task.id}
            className={`saved-task-row ${!task.onDailyList ? "library-task-row" : ""}`}
          >
            <span
              className="saved-task-dot"
              style={{ background: task.color }}
              aria-hidden
            />
            <div className="saved-task-copy">
              <h3>{task.name}</h3>
              <p>
                {task.goalKind === "minimum" ? "Build time" : "Limit time"} ·{" "}
                {formatDuration(targets?.[task.id] ?? task.targetSeconds)}
              </p>
            </div>
            <div className="saved-task-actions">
              {!task.onDailyList && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending !== null}
                  aria-label={`Adjust allotment for ${task.name}`}
                  onClick={() => {
                    setAdjusting(task.id);
                    setMinutes((targets?.[task.id] ?? task.targetSeconds) / 60);
                  }}
                >
                  Adjust
                </button>
              )}
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
            </div>
            {adjusting === task.id && (
              <label className="saved-allotment-input">
                Today’s allotment in minutes
                <input
                  aria-label="Today’s allotment in minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
                <span className="form-hint">
                  Today only; the saved default stays unchanged.
                </span>
              </label>
            )}
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
