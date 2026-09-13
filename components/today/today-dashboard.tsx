"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Pause, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import {
  elapsedSecondsForDate,
  elapsedSeconds,
  DAILY_GOAL_SECONDS,
  formatDuration,
  formatSignedDuration,
  taskDisplaySeconds,
} from "@/lib/domain/time";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StreakBadge } from "@/components/ui/streak-badge";
import { StreakSaverBadge } from "@/components/ui/streak-saver-badge";
import { SortableTaskCard } from "@/components/tasks/sortable-task-card";
import { ConfirmTaskAction } from "@/components/tasks/confirm-task-action";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskLibraryDialog } from "@/components/tasks/task-library-dialog";
import { dailyTasks } from "@/lib/domain/task-list";
import { taskTargetForDate } from "@/lib/domain/task-targets";

import { phraseForDate } from "./daily-phrase";

export function TodayDashboard() {
  const app = useTimeEight();
  const [adding, setAdding] = useState(false);
  const [confirmPauseAll, setConfirmPauseAll] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const activeTasks = dailyTasks(app.tasks);
  const dailyGoal = DAILY_GOAL_SECONDS;
  const todaySeconds = app.totals.get(app.today) ?? 0;
  const dailyPercent = Math.round((todaySeconds / dailyGoal) * 100);
  const streakTodaySeconds = app.streakTotals.get(app.today) ?? 0;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const trackedByTask = useMemo(() => {
    const result = new Map<string, number>();
    app.entries
      .filter((entry) => entry.localDate === app.today)
      .forEach((entry) =>
        result.set(
          entry.taskId,
          (result.get(entry.taskId) ?? 0) + entry.durationSeconds,
        ),
      );
    return result;
  }, [app.entries, app.today]);

  useEffect(() => {
    for (const timer of app.activeTimers) {
      const task = activeTasks.find((item) => item.id === timer.taskId);
      if (!task || task.goalKind !== "limit" || timer.limitOverride) continue;
      const total =
        (trackedByTask.get(task.id) ?? 0) +
        elapsedSecondsForDate(timer, app.today, app.now);
      if (total >= taskTargetForDate(task, app.taskDailyTargets, app.today))
        void app.pauseTimer(task.id);
    }
  }, [activeTasks, app, trackedByTask]);

  function reorder(from: number, to: number) {
    if (to < 0 || to >= activeTasks.length) return;
    void app.reorderTasks(
      arrayMove(activeTasks, from, to).map((task) => task.id),
    );
  }

  function dragEnded(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = activeTasks.findIndex((task) => task.id === event.active.id);
    const to = activeTasks.findIndex((task) => task.id === event.over!.id);
    reorder(from, to);
  }

  function activeSecondsForTask(taskId: string) {
    const timer = app.activeTimers.find((item) => item.taskId === taskId);
    return timer ? elapsedSecondsForDate(timer, app.today, app.now) : 0;
  }

  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: app.profile.timezone,
  }).format(new Date());
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 18
                ? "afternoon"
                : "evening"}
            , {app.profile.displayName || "friend"}.
          </h1>
        </div>
      </header>
      {!app.profile.onboardingCompleted && (
        <aside className="setup-banner">
          <div>
            <strong>Set your own rhythm.</strong>
            <span>Confirm your name and timezone for future tracking.</span>
          </div>
          <Link className="secondary-button" href="/onboarding">
            Finish setup
          </Link>
        </aside>
      )}
      <section className="today-grid" aria-label="Today's progress">
        <article className="daily-card">
          <ProgressRing
            size={152}
            value={dailyPercent}
            label={`${dailyPercent}% of daily goal`}
          >
            <strong>{formatDuration(todaySeconds)}</strong>
            <span>of {formatDuration(dailyGoal)}</span>
          </ProgressRing>
          <div className="daily-summary">
            <p className="eyebrow">Today’s rhythm</p>
            <h2>{phraseForDate(app.today)}</h2>
            <p className="muted">
              {todaySeconds >= dailyGoal
                ? `${formatDuration(todaySeconds - dailyGoal)} beyond your eight-hour goal.`
                : `${formatDuration(dailyGoal - todaySeconds)} remain in your eight-hour daily goal.`}
            </p>
            <div className="status-badges" aria-label="Streak status">
              <StreakBadge
                days={app.streak.currentDays}
                todaySeconds={streakTodaySeconds}
              />
              <StreakSaverBadge
                available={app.streak.saverAvailable}
                consumedDate={app.streak.saverConsumedDate}
                today={app.today}
                timezone={app.profile.timezone}
              />
            </div>
          </div>
        </article>
        <article
          className="active-timers-card"
          aria-labelledby="active-timers-title"
        >
          <div className="active-timers-heading">
            <div>
              <h2 id="active-timers-title">Active timers</h2>
            </div>
            {app.activeTimers.length > 1 && (
              <button
                className="secondary-button"
                onClick={() => setConfirmPauseAll(true)}
              >
                Pause all
              </button>
            )}
          </div>
          {!app.hydrated ? (
            <p className="active-timers-empty">Loading your timers…</p>
          ) : app.activeTimers.length === 0 ? (
            <div className="active-timers-empty">
              <Timer size={28} aria-hidden />
              <strong>No timers running</strong>
              <p>
                Start a timer from your daily list. It will appear here while it
                runs.
              </p>
            </div>
          ) : (
            <ul
              className="active-timers-list"
              tabIndex={0}
              aria-label="Running timer sessions"
            >
              {app.activeTimers.map((timer) => {
                const task = app.tasks.find((task) => task.id === timer.taskId);
                const displaySeconds =
                  task?.goalKind === "limit"
                    ? taskDisplaySeconds(
                        "limit",
                        (trackedByTask.get(task.id) ?? 0) +
                          elapsedSecondsForDate(timer, app.today, app.now),
                        taskTargetForDate(
                          task,
                          app.taskDailyTargets,
                          app.today,
                        ),
                      )
                    : elapsedSeconds(timer, app.now);
                return (
                  <li key={timer.id}>
                    <span
                      className="active-task-dot"
                      style={{ background: task?.color ?? "var(--teal)" }}
                      aria-hidden
                    />
                    <div className="active-timer-copy">
                      <strong title={task?.name ?? "Task timer"}>
                        {task?.name ?? "Task timer"}
                      </strong>
                      {displaySeconds >= 0 && (
                        <span>
                          {task?.goalKind === "limit"
                            ? "Time remaining"
                            : "Current session"}
                        </span>
                      )}
                    </div>
                    <span
                      className={`active-timer-duration ${displaySeconds < 0 ? "negative-duration" : ""}`}
                    >
                      {formatSignedDuration(displaySeconds, {
                        clock: true,
                      })}
                    </span>
                    <button
                      className="secondary-button active-timer-pause"
                      aria-label={`Pause active timer ${task?.name ?? "task"}`}
                      onClick={() => void app.pauseTimer(timer.taskId)}
                    >
                      <Pause size={18} fill="currentColor" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>
      <section className="tasks-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your daily list</p>
            <h2>Your timers</h2>
          </div>
          <div className="task-list-actions">
            <button
              className="secondary-button"
              disabled={!app.hydrated}
              onClick={() => setLibraryOpen(true)}
            >
              Task list
            </button>
            <button
              id="add-daily-task"
              className="primary-button"
              disabled={!app.hydrated}
              onClick={() => setAdding(true)}
            >
              <Plus size={18} />
              Add task
            </button>
          </div>
        </div>
        <p className="daily-list-hint">
          Your choices carry forward each day. Remove a timer when you don’t
          need it; add it back from your Task list.
        </p>
        {!app.hydrated ? (
          <div className="empty-card">Loading your timers…</div>
        ) : activeTasks.length === 0 ? (
          <div className="empty-card">
            <h3>Your day is open.</h3>
            <p>Add one thing you want to build up or gently limit.</p>
            <button className="primary-button" onClick={() => setAdding(true)}>
              Add your first task
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={dragEnded}
          >
            <SortableContext
              items={activeTasks.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-list">
                {activeTasks.map((task, index) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    count={activeTasks.length}
                    move={reorder}
                    trackedSeconds={trackedByTask.get(task.id) ?? 0}
                    activeSeconds={activeSecondsForTask(task.id)}
                    timer={app.activeTimers.find(
                      (timer) => timer.taskId === task.id,
                    )}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
      <ConfirmTaskAction
        open={confirmPauseAll}
        onOpenChange={setConfirmPauseAll}
        title="Pause all timers?"
        description="All running timers will pause and their elapsed time will be saved. You can restart each timer when you’re ready."
        cancelLabel="Keep running"
        confirmLabel="Pause all timers"
        onConfirm={app.pauseAll}
      />
      <TaskDialog
        open={adding}
        onOpenChange={setAdding}
        onSave={app.addTask}
        savedTasks={app.tasks}
        savedTargets={Object.fromEntries(
          app.tasks.map((task) => [
            task.id,
            taskTargetForDate(task, app.taskDailyTargets, app.today),
          ]),
        )}
        onSelect={app.addTaskToDailyList}
      />
      <TaskLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </>
  );
}
