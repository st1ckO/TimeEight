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
  Minus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActiveTimer, Task } from "@/lib/domain/types";
import { formatDuration, taskDisplaySeconds } from "@/lib/domain/time";
import { useTimeEight } from "@/components/app/app-provider";
import { TaskDialog } from "./task-dialog";
import { ConfirmTaskAction } from "./confirm-task-action";
import { taskTargetForDate } from "@/lib/domain/task-targets";

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
  const app = useTimeEight();
  const { startTimer, pauseTimer, updateTodayTask, removeTaskFromDailyList } =
    app;
  const targetSeconds = taskTargetForDate(
    task,
    app.taskDailyTargets,
    app.today,
  );
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    function dismissOutside(event: PointerEvent) {
      if (!menuWrapRef.current?.contains(event.target as Node)) setMenu(false);
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenu(false);
      menuTriggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [menu]);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const liveSeconds = trackedSeconds + activeSeconds;
  const displaySeconds = taskDisplaySeconds(
    task.goalKind,
    liveSeconds,
    targetSeconds,
  );
  const percent = Math.min(100, (liveSeconds / targetSeconds) * 100);
  const limitReached =
    task.goalKind === "limit" && liveSeconds >= targetSeconds;
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
            role="progressbar"
            aria-label={`${task.name} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="task-time">
          <strong>
            {formatDuration(displaySeconds, { clock: Boolean(timer) })}
            {task.goalKind === "limit" && !timer ? " left" : ""}
          </strong>
          <button
            type="button"
            className="task-target-button"
            aria-label={`Edit today’s allotment for ${task.name}`}
            onClick={() => setEditing(true)}
          >
            {task.goalKind === "minimum"
              ? `of ${formatDuration(targetSeconds)}`
              : `${formatDuration(targetSeconds)} limit`}
          </button>
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
        <div className="task-menu-wrap" ref={menuWrapRef}>
          <button
            ref={menuTriggerRef}
            type="button"
            className="more-button"
            aria-label={`Actions for ${task.name}`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div
              className="task-menu"
              role="group"
              aria-label={`Task actions for ${task.name}`}
            >
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
                className="task-menu-edit"
                onClick={() => {
                  setEditing(true);
                  setMenu(false);
                }}
              >
                <Pencil size={16} />
                Edit
              </button>
              <button
                className="task-menu-remove"
                onClick={() => {
                  setMenu(false);
                  setConfirmRemoval(true);
                }}
              >
                <Minus size={16} />
                Remove
              </button>
            </div>
          )}
        </div>
      </article>
      <TaskDialog
        open={editing}
        onOpenChange={setEditing}
        task={task}
        todayEditor={{
          localDate: app.today,
          targetSeconds,
          trackedSeconds: liveSeconds,
          running: Boolean(timer),
        }}
        onSave={(input) =>
          updateTodayTask(task.id, input, {
            localDate: app.today,
            useAsDefault: input.useAsDefault,
            confirmStop: input.confirmStop,
          })
        }
      />
      <ConfirmTaskAction
        open={confirmRemoval}
        onOpenChange={setConfirmRemoval}
        title={`Remove ${task.name} from daily list?`}
        description="The task stays in your saved Task list and its tracked history is kept. Any running timer will stop and its elapsed time will be saved. This choice carries forward until you add the task again."
        confirmLabel="Remove task"
        onConfirm={async () => {
          await removeTaskFromDailyList(task.id);
          document.getElementById("add-daily-task")?.focus();
        }}
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
