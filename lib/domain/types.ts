export type GoalKind = "minimum" | "limit";
export type EntrySource = "timer" | "manual" | "recovered";
export type ThemePreference = "system" | "light" | "dark";

export interface Profile {
  id: string;
  displayName: string;
  timezone: string;
  theme: ThemePreference;
  onboardingCompleted: boolean;
}

export interface DailyGoalChange {
  id: string;
  userId: string;
  effectiveDate: string;
  goalSeconds: number;
}

export interface Task {
  id: string;
  userId: string;
  name: string;
  color: string;
  goalKind: GoalKind;
  targetSeconds: number;
  sortOrder: number;
  archivedAt: string | null;
  onDailyList: boolean;
}

export interface ActiveTimer {
  id: string;
  userId: string;
  taskId: string;
  startedAt: string;
  timezone: string;
  accumulatedSeconds: number;
  checkpointedAt: string;
  checkpointSeconds: number;
  limitOverride: boolean;
  mutationId: string;
}

export interface TaskDailyTarget {
  id: string;
  userId: string;
  taskId: string;
  localDate: string;
  targetSeconds: number;
}

export interface TimeEntry {
  id: string;
  userId: string;
  taskId: string;
  localDate: string;
  durationSeconds: number;
  source: EntrySource;
  startedAt: string | null;
  endedAt: string | null;
  manuallyAdjusted: boolean;
  correctionOriginalTaskId: string | null;
  correctionOriginalLocalDate: string | null;
  correctionOriginalDurationSeconds: number | null;
  mutationId: string;
}

export interface DailySummary {
  localDate: string;
  trackedSeconds: number;
  goalSeconds: number;
  entryCount: number;
}

export interface StreakSummary {
  currentDays: number;
  longestDays: number;
  saverAvailable: boolean;
  saverConsumedDate: string | null;
  protectedDates: string[];
}
