import type { StreakSummary } from "./types";

export const STREAK_SECONDS = 3 * 60 * 60;

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
