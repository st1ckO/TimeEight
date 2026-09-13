import type { ActiveTimer, GoalKind, TimeEntry } from "./types";

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string) {
  let formatter = dateFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatterCache.set(timezone, formatter);
  }
  return formatter;
}

export function localDateAt(
  timestamp: number | Date,
  timezone: string,
): string {
  const parts = formatterFor(timezone).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function elapsedSeconds(
  timer: Pick<ActiveTimer, "startedAt" | "accumulatedSeconds">,
  now = Date.now(),
): number {
  const activeSeconds = Math.max(
    0,
    Math.floor((now - Date.parse(timer.startedAt)) / 1000),
  );
  return timer.accumulatedSeconds + activeSeconds;
}

export function elapsedSecondsForDate(
  timer: Pick<ActiveTimer, "startedAt" | "timezone" | "accumulatedSeconds">,
  localDate: string,
  now = Date.now(),
): number {
  const slices = splitDurationAcrossLocalDates(
    timer.startedAt,
    new Date(now).toISOString(),
    timer.timezone,
  );
  const activeSeconds = slices
    .filter((slice) => slice.localDate === localDate)
    .reduce((sum, slice) => sum + slice.durationSeconds, 0);
  const accumulatedOnThisDate =
    localDateAt(Date.parse(timer.startedAt), timer.timezone) === localDate
      ? timer.accumulatedSeconds
      : 0;
  return activeSeconds + accumulatedOnThisDate;
}

export function taskDisplaySeconds(
  kind: GoalKind,
  trackedSeconds: number,
  targetSeconds: number,
): number {
  return kind === "limit" ? targetSeconds - trackedSeconds : trackedSeconds;
}

export function formatDuration(
  totalSeconds: number,
  options: { clock?: boolean } = {},
): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (options.clock)
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatSignedDuration(
  seconds: number,
  options: { clock?: boolean } = {},
): string {
  return `${seconds < 0 ? "−" : ""}${formatDuration(Math.abs(seconds), options)}`;
}

export interface DurationSlice {
  localDate: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

export function splitDurationAcrossLocalDates(
  startedAt: string,
  endedAt: string,
  timezone: string,
): DurationSlice[] {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
    return [];

  const slices: DurationSlice[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const date = localDateAt(cursor, timezone);
    let high = Math.min(cursor + 30 * 60 * 60 * 1000, endMs);

    while (high < endMs && localDateAt(high - 1, timezone) === date) {
      high = Math.min(high + 24 * 60 * 60 * 1000, endMs);
    }

    if (localDateAt(high - 1, timezone) === date) {
      const seconds = Math.max(1, Math.round((high - cursor) / 1000));
      slices.push({
        localDate: date,
        durationSeconds: seconds,
        startedAt: new Date(cursor).toISOString(),
        endedAt: new Date(high).toISOString(),
      });
      break;
    }

    let low = cursor;
    while (high - low > 1) {
      const middle = low + Math.floor((high - low) / 2);
      if (localDateAt(middle, timezone) === date) low = middle;
      else high = middle;
    }

    const boundary = Math.min(endMs, high);
    const seconds = Math.max(1, Math.round((boundary - cursor) / 1000));
    slices.push({
      localDate: date,
      durationSeconds: seconds,
      startedAt: new Date(cursor).toISOString(),
      endedAt: new Date(boundary).toISOString(),
    });
    cursor = boundary;
  }

  return slices;
}

export function aggregateEntries(entries: TimeEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  entries.forEach((entry) =>
    totals.set(
      entry.localDate,
      (totals.get(entry.localDate) ?? 0) + entry.durationSeconds,
    ),
  );
  return totals;
}

export const DAILY_GOAL_SECONDS = 8 * 60 * 60;

export function goalForDate(
  changes: { effectiveDate: string; goalSeconds: number }[],
  date: string,
  fallback = DAILY_GOAL_SECONDS,
  fixedFromDate?: string,
): number {
  if (fixedFromDate && date >= fixedFromDate) return DAILY_GOAL_SECONDS;
  return (
    [...changes]
      .filter((change) => change.effectiveDate <= date)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
      ?.goalSeconds ?? fallback
  );
}
