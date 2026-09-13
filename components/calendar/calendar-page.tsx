"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ConfirmTaskAction } from "@/components/tasks/confirm-task-action";
import * as Select from "@radix-ui/react-select";
import { taskTargetForDate } from "@/lib/domain/task-targets";

import {
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  formatDuration,
  formatSignedDuration,
  goalForDate,
} from "@/lib/domain/time";
import { historyOverLimitSeconds } from "@/lib/domain/limit-display";
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
  const entryActionTrigger = useRef<HTMLButtonElement>(null);
  const historyRegion = useRef<HTMLDivElement>(null);
  function returnToHistory() {
    requestAnimationFrame(() => {
      const trigger = entryActionTrigger.current;
      if (trigger?.isConnected) trigger.focus();
      else historyRegion.current?.focus();
    });
  }
  const [historyOrder, setHistoryOrder] = useState<"latest" | "oldest">(
    "latest",
  );
  const cells = useMemo(() => monthCells(month), [month]);
  const entries = app.entries
    .filter((entry) => entry.localDate === selectedDate)
    .sort((a, b) => {
      if (!a.startedAt) return b.startedAt ? 1 : 0;
      if (!b.startedAt) return -1;
      const chronological = a.startedAt.localeCompare(b.startedAt);
      return historyOrder === "latest" ? -chronological : chronological;
    });
  const tasksById = new Map(app.tasks.map((task) => [task.id, task]));
  const overLimitByEntry = useMemo(
    () => historyOverLimitSeconds(app.entries, app.tasks, app.taskDailyTargets),
    [app.entries, app.tasks, app.taskDailyTargets],
  );

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
          <div className="day-summary">
            <div>
              <p className="eyebrow">Selected day</p>
              <h2>{selectedLabel}</h2>
            </div>
            <div className="day-total">
              <strong>
                {formatDuration(app.totals.get(selectedDate) ?? 0)}
              </strong>
              <span>
                tracked against{" "}
                {formatDuration(
                  goalForDate(
                    app.dailyGoals,
                    selectedDate,
                    undefined,
                    app.today,
                  ),
                )}
              </span>
            </div>
          </div>
          <div className="day-history-toolbar">
            <Select.Root
              value={historyOrder}
              onValueChange={(value) =>
                setHistoryOrder(value as "latest" | "oldest")
              }
            >
              <Select.Trigger
                className="history-sort"
                aria-label={`History order: ${historyOrder === "latest" ? "Latest first" : "Oldest first"}`}
              >
                {historyOrder === "latest" ? (
                  <ArrowDown size={16} aria-hidden />
                ) : (
                  <ArrowUp size={16} aria-hidden />
                )}
                <Select.Value />
                <Select.Icon>
                  <ChevronDown size={14} aria-hidden />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="history-sort-menu entry-task-menu"
                  position="popper"
                  align="start"
                  sideOffset={6}
                  collisionPadding={14}
                >
                  <Select.Viewport>
                    <Select.Item value="latest" className="entry-task-option">
                      <div>
                        <Select.ItemText>Latest first</Select.ItemText>
                        <small>Recent timers at the top</small>
                      </div>
                      <Select.ItemIndicator>
                        <Check size={16} aria-hidden />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="oldest" className="entry-task-option">
                      <div>
                        <Select.ItemText>Oldest first</Select.ItemText>
                        <small>Earlier timers at the top</small>
                      </div>
                      <Select.ItemIndicator>
                        <Check size={16} aria-hidden />
                      </Select.ItemIndicator>
                    </Select.Item>
                  </Select.Viewport>
                  <p>Manual entries stay at the end.</p>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <button
              className="primary-button calendar-add-time"
              onClick={() => setAdding(true)}
              disabled={app.tasks.length === 0}
            >
              <Plus size={18} />
              Add time
            </button>
          </div>
          <div
            className="history-list"
            ref={historyRegion}
            key={selectedDate}
            role="region"
            aria-label="Tracked entries"
            tabIndex={0}
          >
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
                    <h3
                      title={
                        tasksById.get(entry.taskId)?.name ?? "Archived task"
                      }
                    >
                      {tasksById.get(entry.taskId)?.name ?? "Archived task"}
                    </h3>
                    <div className="history-entry-meta">
                      <span
                        className="history-entry-source"
                        data-source={entry.source}
                        data-corrected={
                          entry.manuallyAdjusted && entry.source !== "manual"
                        }
                        title={
                          entry.source === "recovered"
                            ? "Recovered checkpoint"
                            : undefined
                        }
                      >
                        {entry.source === "timer"
                          ? "Timer"
                          : entry.source === "recovered"
                            ? "Recovered"
                            : "Manual addition"}
                        {entry.manuallyAdjusted && entry.source !== "manual"
                          ? " · corrected"
                          : ""}
                      </span>
                      {tasksById.get(entry.taskId) && (
                        <span className="history-entry-target">
                          Allotment:{" "}
                          {formatDuration(
                            taskTargetForDate(
                              tasksById.get(entry.taskId)!,
                              app.taskDailyTargets ?? [],
                              entry.localDate,
                            ),
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <strong
                    className={
                      overLimitByEntry.has(entry.id)
                        ? "negative-duration"
                        : undefined
                    }
                    title={
                      overLimitByEntry.has(entry.id)
                        ? `${formatDuration(entry.durationSeconds)} tracked; ${formatDuration(overLimitByEntry.get(entry.id)!)} over the daily limit`
                        : undefined
                    }
                  >
                    {formatSignedDuration(
                      overLimitByEntry.has(entry.id)
                        ? -overLimitByEntry.get(entry.id)!
                        : entry.durationSeconds,
                    )}
                  </strong>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="icon-button history-entry-menu-trigger"
                        onFocus={(event) => {
                          entryActionTrigger.current = event.currentTarget;
                        }}
                        onPointerDown={(event) => {
                          entryActionTrigger.current = event.currentTarget;
                        }}
                        aria-label={`Entry actions for ${tasksById.get(entry.taskId)?.name ?? "archived task"}`}
                      >
                        <MoreHorizontal size={19} aria-hidden />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="history-actions-menu"
                        align="end"
                        sideOffset={6}
                        collisionPadding={14}
                      >
                        <DropdownMenu.Item onSelect={() => setEditing(entry)}>
                          <Pencil size={16} aria-hidden />
                          Edit entry
                        </DropdownMenu.Item>
                        {canRevertTimeEntryCorrection(entry) && (
                          <DropdownMenu.Item
                            onSelect={() =>
                              void app.revertEntryCorrection(entry.id)
                            }
                          >
                            <RotateCcw size={16} aria-hidden />
                            Restore original time
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          className="history-delete-action"
                          onSelect={() => setDeleting(entry.id)}
                        >
                          <Trash2 size={16} aria-hidden />
                          Delete entry
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
      <ConfirmTaskAction
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            returnToHistory();
          }
        }}
        title="Delete tracked entry?"
        description="This removes the entry from your history and daily total. This cannot be undone."
        confirmLabel="Delete entry"
        onConfirm={async () => {
          if (deleting) await app.deleteEntry(deleting);
        }}
      />
      <EntryDialog
        open={adding}
        onOpenChange={setAdding}
        date={selectedDate}
        tasks={app.tasks}
        onSave={app.addEntry}
      />
      <EntryDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(undefined);
            returnToHistory();
          }
        }}
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
