import type { TimeEntry } from "./types";

export interface TimeEntryCorrectionInput {
  taskId: string;
  localDate: string;
  durationSeconds: number;
}

export function correctTimeEntry(
  entry: TimeEntry,
  correction: TimeEntryCorrectionInput,
): TimeEntry {
  const canPreserveTimerOriginal = entry.source !== "manual";

  return {
    ...entry,
    ...correction,
    manuallyAdjusted: true,
    correctionOriginalTaskId: canPreserveTimerOriginal
      ? (entry.correctionOriginalTaskId ?? entry.taskId)
      : null,
    correctionOriginalLocalDate: canPreserveTimerOriginal
      ? (entry.correctionOriginalLocalDate ?? entry.localDate)
      : null,
    correctionOriginalDurationSeconds: canPreserveTimerOriginal
      ? (entry.correctionOriginalDurationSeconds ?? entry.durationSeconds)
      : null,
  };
}

export function canRevertTimeEntryCorrection(entry: TimeEntry): boolean {
  return (
    entry.source !== "manual" &&
    entry.manuallyAdjusted &&
    typeof entry.correctionOriginalTaskId === "string" &&
    typeof entry.correctionOriginalLocalDate === "string" &&
    typeof entry.correctionOriginalDurationSeconds === "number"
  );
}

export function revertTimeEntryCorrection(entry: TimeEntry): TimeEntry | null {
  if (!canRevertTimeEntryCorrection(entry)) return null;
  const taskId = entry.correctionOriginalTaskId;
  const localDate = entry.correctionOriginalLocalDate;
  const durationSeconds = entry.correctionOriginalDurationSeconds;
  if (
    typeof taskId !== "string" ||
    typeof localDate !== "string" ||
    typeof durationSeconds !== "number"
  )
    return null;

  return {
    ...entry,
    taskId,
    localDate,
    durationSeconds,
    manuallyAdjusted: false,
    correctionOriginalTaskId: null,
    correctionOriginalLocalDate: null,
    correctionOriginalDurationSeconds: null,
  };
}
