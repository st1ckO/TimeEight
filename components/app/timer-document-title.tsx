"use client";

import { useEffect } from "react";
import { elapsedSeconds, formatStopwatchDuration } from "@/lib/domain/time";
import type { ActiveTimer } from "@/lib/domain/types";
import { useTimeEight } from "./app-provider";

const DEFAULT_TITLE = "TimeEight";

function mostRecentlyStarted(timers: ActiveTimer[]) {
  return timers.reduce<ActiveTimer | undefined>((latest, timer) => {
    if (!latest) return timer;
    return Date.parse(timer.startedAt) >= Date.parse(latest.startedAt)
      ? timer
      : latest;
  }, undefined);
}

export function TimerDocumentTitle() {
  const { activeTimers, now } = useTimeEight();
  const timer = mostRecentlyStarted(activeTimers);
  const title = timer
    ? `${formatStopwatchDuration(elapsedSeconds(timer, now))} · ${DEFAULT_TITLE}`
    : DEFAULT_TITLE;

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(
    () => () => {
      document.title = DEFAULT_TITLE;
    },
    [],
  );

  return null;
}
