"use client";

/* dnd-kit intentionally exposes DOM-ref setters from a hook. */
/* eslint-disable react-hooks/refs */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { ActiveTimer, Task } from "@/lib/domain/types";
import { formatDuration, taskDisplaySeconds } from "@/lib/domain/time";
import { useTimeEight } from "@/components/app/app-provider";
import { TaskDialog } from "./task-dialog";

export function SortableTaskCard({
  task,
  trackedSeconds,
  activeSeconds,
  timer,
  index,
  count,
  move,
}: {
  task: Task;
  trackedSeconds: number;
  activeSeconds: number;
  timer?: ActiveTimer;
  index: number;
  count: number;
  move(from: number, to: number): void;
}) {
  const { startTimer, pauseTimer, updateTask, archiveTask } = useTimeEight();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const liveSeconds = trackedSeconds + activeSeconds;
  const displaySeconds = taskDisplaySeconds(
    task.goalKind,
    liveSeconds,
    task.targetSeconds,
  );
  const percent = Math.min(100, (liveSeconds / task.targetSeconds) * 100);
  const limitReached =
    task.goalKind === "limit" && liveSeconds >= task.targetSeconds;
  const sortable = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    "--task-color": task.color,
  } as React.CSSProperties;

  async function toggleTimer() {
    if (timer) return pauseTimer(task.id);
    if (limitReached) return setConfirmOverride(true);
    return startTimer(task.id);
  }

  return (
    <>
      <article
        ref={sortable.setNodeRef}
        style={style}
        className={`task-card ${timer ? "is-active" : ""}`}
      >
        <button
          className="drag-handle"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Drag to reorder ${task.name}`}
        >
          <GripVertical size={20} />
        </button>
        <span className="task-dot" aria-hidden />
        <div className="task-copy">
          <div>
            <h3>{task.name}</h3>
            <p>{task.goalKind === "minimum" ? "Build time" : "Limit time"}</p>
          </div>
          <div
            className="task-progress"
            aria-label={`${Math.round(percent)}% of task target`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="task-time">
          <strong>
            {formatDuration(displaySeconds, { clock: Boolean(timer) })}
            {task.goalKind === "limit" && !timer ? " left" : ""}
          </strong>
          <span>
            {task.goalKind === "minimum"
              ? `of ${formatDuration(task.targetSeconds)}`
              : `${formatDuration(task.targetSeconds)} limit`}
          </span>
        </div>
        <button
          className={`timer-button ${timer ? "pause" : ""}`}
          onClick={() => void toggleTimer()}
          aria-label={`${timer ? "Pause" : limitReached ? "Continue" : "Start"} ${task.name}`}
        >
          {timer ? (
            <Pause fill="currentColor" size={20} />
          ) : (
            <Play fill="currentColor" size={20} />
          )}
        </button>
        <div className="task-menu-wrap">
          <button
            className="more-button"
            aria-label={`Actions for ${task.name}`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="task-menu">
              <button
                onClick={() => {
                  move(index, index - 1);
                  setMenu(false);
                }}
                disabled={index === 0}
              >
                <ArrowUp size={16} />
                Move up
              </button>
              <button
                onClick={() => {
                  move(index, index + 1);
                  setMenu(false);
                }}
                disabled={index === count - 1}
              >
                <ArrowDown size={16} />
                Move down
              </button>
              <button
                onClick={() => {
                  setEditing(true);
                  setMenu(false);
                }}
              >
                <Pencil size={16} />
                Edit
              </button>
              <button onClick={() => void archiveTask(task.id)}>
                <Trash2 size={16} />
                Archive
              </button>
            </div>
          )}
        </div>
      </article>
      <TaskDialog
        open={editing}
        onOpenChange={setEditing}
        task={task}
        onSave={(input) => updateTask(task.id, input)}
      />
      {confirmOverride && (
        <div className="dialog-overlay">
          <div
            className="confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-title"
          >
            <p className="eyebrow">Limit reached</p>
            <h2 id="limit-title">Continue {task.name}?</h2>
            <p>
              You reached today’s limit. Continuing is always your choice, and
              the extra time will still be tracked.
            </p>
            <div>
              <button
                className="secondary-button"
                onClick={() => setConfirmOverride(false)}
              >
                Keep paused
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  void startTimer(task.id, true);
                  setConfirmOverride(false);
                }}
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
