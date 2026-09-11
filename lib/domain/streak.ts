import type { StreakSummary, TimeEntry } from "./types";

export const STREAK_SECONDS = 3 * 60 * 60;

export type StreakTier =
  "spark" | "gold" | "orange" | "coral" | "magenta" | "violet";

export function streakTierForDays(days: number): StreakTier {
  if (days >= 200) return "violet";
  if (days >= 100) return "magenta";
  if (days >= 30) return "coral";
  if (days >= 10) return "orange";
  if (days >= 3) return "gold";
  return "spark";
}

export function nextStreakTierAt(days: number): number | null {
  return [3, 10, 30, 100, 200].find((threshold) => threshold > days) ?? null;
}

export function aggregateStreakEntries(
  entries: ReadonlyArray<
    Pick<
      TimeEntry,
      "localDate" | "durationSeconds" | "source" | "manuallyAdjusted"
    >
  >,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.source === "manual" || entry.manuallyAdjusted) continue;
    totals.set(
      entry.localDate,
      (totals.get(entry.localDate) ?? 0) + entry.durationSeconds,
    );
  }
  return totals;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, count: number): string {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKey(date);
}

function mondayKey(key: string): string {
  const date = dateFromKey(key);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return dateKey(date);
}

export function calculateStreak(
  totals: ReadonlyMap<string, number>,
  today: string,
  accountStart: string,
): StreakSummary {
  const protectedDates: string[] = [];
  const saverByWeek = new Set<string>();
  let running = 0;
  let longest = 0;
  let cursor = accountStart;
  const yesterday = addDays(today, -1);

  while (cursor <= yesterday) {
    const achieved = (totals.get(cursor) ?? 0) >= STREAK_SECONDS;
    const week = mondayKey(cursor);
    if (achieved) {
      running += 1;
    } else if (running > 0 && !saverByWeek.has(week)) {
      saverByWeek.add(week);
      protectedDates.push(cursor);
      running += 1;
    } else {
      running = 0;
    }
    longest = Math.max(longest, running);
    cursor = addDays(cursor, 1);
  }

  if ((totals.get(today) ?? 0) >= STREAK_SECONDS) {
    running += 1;
    longest = Math.max(longest, running);
  }

  const currentWeek = mondayKey(today);
  const consumedDate =
    protectedDates.find((date) => mondayKey(date) === currentWeek) ?? null;
  return {
    currentDays: running,
    longestDays: longest,
    saverAvailable: consumedDate === null,
    saverConsumedDate: consumedDate,
    protectedDates,
  };
}

export function streakProgressSeconds(todaySeconds: number): number {
  return Math.min(STREAK_SECONDS, Math.max(0, todaySeconds));
}
