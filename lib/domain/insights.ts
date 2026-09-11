import type { TimeEntry } from "./types";

function fromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function key(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDateDays(dateKey: string, count: number) {
  const date = fromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + count);
  return key(date);
}

export function mondayFor(dateKey: string) {
  const date = fromKey(dateKey);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return key(date);
}

export interface InsightSummary {
  mostTrackedDay: { date: string; seconds: number } | null;
  mostTrackedWeek: { startDate: string; seconds: number } | null;
  longestSession: { entryId: string; taskId: string; seconds: number } | null;
  currentWeekSeconds: number;
  currentWeekDays: { date: string; seconds: number }[];
}

export function calculateInsights(
  entries: TimeEntry[],
  today: string,
): InsightSummary {
  const dayTotals = new Map<string, number>();
  const weekTotals = new Map<string, number>();
  let longestSession: InsightSummary["longestSession"] = null;

  for (const entry of entries) {
    dayTotals.set(
      entry.localDate,
      (dayTotals.get(entry.localDate) ?? 0) + entry.durationSeconds,
    );
    const week = mondayFor(entry.localDate);
    weekTotals.set(week, (weekTotals.get(week) ?? 0) + entry.durationSeconds);
    if (!longestSession || entry.durationSeconds > longestSession.seconds) {
      longestSession = {
        entryId: entry.id,
        taskId: entry.taskId,
        seconds: entry.durationSeconds,
      };
    }
  }

  const mostTrackedDay = [...dayTotals].reduce<
    InsightSummary["mostTrackedDay"]
  >(
    (best, [date, seconds]) =>
      !best || seconds > best.seconds ? { date, seconds } : best,
    null,
  );
  const mostTrackedWeek = [...weekTotals].reduce<
    InsightSummary["mostTrackedWeek"]
  >(
    (best, [startDate, seconds]) =>
      !best || seconds > best.seconds ? { startDate, seconds } : best,
    null,
  );
  const currentMonday = mondayFor(today);
  const currentWeekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDateDays(currentMonday, index);
    return { date, seconds: dayTotals.get(date) ?? 0 };
  });

  return {
    mostTrackedDay,
    mostTrackedWeek,
    longestSession,
    currentWeekSeconds: weekTotals.get(currentMonday) ?? 0,
    currentWeekDays,
  };
}
