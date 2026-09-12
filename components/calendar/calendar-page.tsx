"use client";
import { taskTargetForDate } from "@/lib/domain/task-targets";

import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatDuration, goalForDate } from "@/lib/domain/time";
import { canRevertTimeEntryCorrection } from "@/lib/domain/corrections";
import type { TimeEntry } from "@/lib/domain/types";
import { EntryDialog } from "./entry-dialog";

function fromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function key(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthCells(monthKey: string) {
  const first = fromKey(`${monthKey}-01`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index);
    return key(date);
  });
}

export function CalendarPage() {
  const app = useTimeEight();
  const [month, setMonth] = useState(app.today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(app.today);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const cells = useMemo(() => monthCells(month), [month]);
  const entries = app.entries
    .filter((entry) => entry.localDate === selectedDate)
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  const tasksById = new Map(app.tasks.map((task) => [task.id, task]));

  function shiftMonth(amount: number) {
    const date = fromKey(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(key(date).slice(0, 7));
  }

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fromKey(`${month}-01`));
  const selectedLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(fromKey(selectedDate));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Your time, in context</p>
          <h1>Calendar</h1>
          <p>
            Each ring shows your tracked time toward the eight-hour daily goal.
          </p>
        </div>
      </header>
      <div className="calendar-layout">
        <section className="calendar-card" aria-label="Tracked time calendar">
          <div className="calendar-toolbar">
            <button
              className="icon-button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <h2>{monthLabel}</h2>
            <button
              className="icon-button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="weekday-row" aria-hidden>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((date) => {
              const seconds = app.totals.get(date) ?? 0;
              const goal = goalForDate(
                app.dailyGoals,
                date,
                undefined,
                app.today,
              );
              const percent = Math.round((seconds / goal) * 100);
              const inMonth = date.startsWith(month);
              const protectedDay = app.streak.protectedDates.includes(date);
              return (
                <button
                  key={date}
                  className={`calendar-day ${selectedDate === date ? "selected" : ""} ${inMonth ? "" : "outside"}`}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={selectedDate === date}
                >
                  <span className="day-number">{Number(date.slice(-2))}</span>
                  <ProgressRing
                    size={48}
                    strokeWidth={8}
                    value={percent}
                    label={`${date}: ${formatDuration(seconds)} tracked of ${formatDuration(goal)} goal`}
                  />
                  {protectedDay && (
                    <ShieldCheck
                      className="day-saver"
                      size={14}
                      aria-label="Streak saver used"
                    />
                  )}
                  <span className="day-time">
                    {seconds ? formatDuration(seconds) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="day-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected day</p>
              <h2>{selectedLabel}</h2>
            </div>
            <button
              className="primary-button"
              onClick={() => setAdding(true)}
              disabled={app.tasks.length === 0}
            >
              <Plus size={18} />
              Add time
            </button>
          </div>
          <div className="day-total">
            <strong>{formatDuration(app.totals.get(selectedDate) ?? 0)}</strong>
            <span>
              tracked against{" "}
              {formatDuration(
                goalForDate(app.dailyGoals, selectedDate, undefined, app.today),
              )}
            </span>
          </div>
          <div className="history-list">
            {entries.length === 0 ? (
              <div className="empty-card">No tracked entries for this day.</div>
            ) : (
              entries.map((entry) => (
                <article className="history-entry" key={entry.id}>
                  <span
                    className="task-dot"
                    style={{ background: tasksById.get(entry.taskId)?.color }}
                  />
                  <div>
                    <h3>
                      {tasksById.get(entry.taskId)?.name ?? "Archived task"}
                    </h3>
                    <p>
                      {entry.source === "timer"
                        ? "Timer"
                        : entry.source === "recovered"
                          ? "Recovered checkpoint"
                          : "Manual correction"}
                      {entry.manuallyAdjusted && entry.source !== "manual"
                        ? " · corrected"
                        : ""}
                    </p>
                    {tasksById.get(entry.taskId) && (
                      <p>
                        Allotment:{" "}
                        {formatDuration(
                          taskTargetForDate(
                            tasksById.get(entry.taskId)!,
                            app.taskDailyTargets ?? [],
                            entry.localDate,
                          ),
                        )}
                      </p>
                    )}
                  </div>
                  <strong>{formatDuration(entry.durationSeconds)}</strong>
                  <div className="history-entry-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit entry for ${tasksById.get(entry.taskId)?.name ?? "archived task"}`}
                      onClick={() => setEditing(entry)}
                    >
                      <Pencil size={17} />
                    </button>
                    {canRevertTimeEntryCorrection(entry) && (
                      <button
                        className="icon-button"
                        aria-label={`Revert correction for ${tasksById.get(entry.taskId)?.name ?? "archived task"}`}
                        title="Restore the original timer entry and streak eligibility"
                        onClick={() => void app.revertEntryCorrection(entry.id)}
                      >
                        <RotateCcw size={17} />
                      </button>
                    )}
                    {deleting !== entry.id ? (
                      <button
                        className="icon-button danger-icon"
                        aria-label={`Delete entry for ${tasksById.get(entry.taskId)?.name ?? "archived task"}`}
                        onClick={() => setDeleting(entry.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : (
                      <button
                        className="danger-button compact"
                        onClick={() => {
                          void app.deleteEntry(entry.id);
                          setDeleting(null);
                        }}
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
      <EntryDialog
        open={adding}
        onOpenChange={setAdding}
        date={selectedDate}
        tasks={app.tasks}
        onSave={app.addEntry}
      />
      <EntryDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(undefined)}
        date={selectedDate}
        tasks={app.tasks}
        entry={editing}
        onSave={(input) =>
          editing ? app.updateEntry(editing.id, input) : Promise.resolve()
        }
      />
    </>
  );
}
