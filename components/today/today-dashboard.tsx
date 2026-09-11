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
import { Flame, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import {
  elapsedSecondsForDate,
  goalForDate,
  formatDuration,
} from "@/lib/domain/time";
import { STREAK_SECONDS } from "@/lib/domain/streak";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SortableTaskCard } from "@/components/tasks/sortable-task-card";
import { TaskDialog } from "@/components/tasks/task-dialog";

export function TodayDashboard() {
  const app = useTimeEight();
  const [adding, setAdding] = useState(false);
  const activeTasks = app.tasks
    .filter((task) => !task.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const dailyGoal = goalForDate(app.dailyGoals, app.today);
  const todaySeconds = app.totals.get(app.today) ?? 0;
  const dailyPercent = Math.round((todaySeconds / dailyGoal) * 100);
  const streakRemaining = Math.max(0, STREAK_SECONDS - todaySeconds);
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
      if (total >= task.targetSeconds) void app.pauseTimer(task.id);
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
      <section className="today-grid" aria-label="Today's progress">
        <article className="daily-card">
          <ProgressRing
            value={dailyPercent}
            label={`${dailyPercent}% of daily goal`}
          >
            <strong>{formatDuration(todaySeconds)}</strong>
            <span>of {formatDuration(dailyGoal)}</span>
          </ProgressRing>
          <div>
            <p className="eyebrow">Today’s rhythm</p>
            <h2>
              {todaySeconds >= dailyGoal
                ? "Your chosen goal is complete."
                : "You’re building a day you can see."}
            </h2>
            <p className="muted">
              {todaySeconds >= dailyGoal
                ? `${formatDuration(todaySeconds - dailyGoal)} beyond the ring, tracked without judgment.`
                : `${formatDuration(dailyGoal - todaySeconds)} remain in your chosen daily goal.`}
            </p>
            <div className="streak-line">
              <Flame size={18} />
              <span>
                {streakRemaining === 0 ? (
                  <>
                    <strong>Streak protected.</strong> You reached three tracked
                    hours.
                  </>
                ) : (
                  <>
                    <strong>{formatDuration(streakRemaining)}</strong> to
                    protect your {app.streak.currentDays || "new"}-day streak
                  </>
                )}
              </span>
            </div>
          </div>
        </article>
        <article className="saver-card">
          <div className="shield">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="eyebrow">Weekly streak saver</p>
            <h3>
              {app.streak.saverAvailable
                ? "Ready when life happens"
                : "Used this week"}
            </h3>
            <p>
              {app.streak.saverAvailable
                ? "Available through Sunday. It protects the first missed day automatically."
                : `Consumed on ${app.streak.saverConsumedDate}. A new saver arrives Monday.`}
            </p>
          </div>
        </article>
      </section>
      <section className="tasks-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reusable daily list</p>
            <h2>Your timers</h2>
          </div>
          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add task
          </button>
        </div>
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
      <TaskDialog open={adding} onOpenChange={setAdding} onSave={app.addTask} />
    </>
  );
}
