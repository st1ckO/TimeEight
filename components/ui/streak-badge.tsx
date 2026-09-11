"use client";

import { Flame } from "lucide-react";
import { useId } from "react";
import {
  nextStreakTierAt,
  STREAK_SECONDS,
  streakTierForDays,
} from "@/lib/domain/streak";
import { formatDuration } from "@/lib/domain/time";

export function StreakBadge({
  days,
  todaySeconds,
}: {
  days: number;
  todaySeconds: number;
}) {
  const tooltipId = useId();
  const completedToday = todaySeconds >= STREAK_SECONDS;
  const remaining = Math.max(0, STREAK_SECONDS - todaySeconds);
  const tier = streakTierForDays(days);
  const nextTier = nextStreakTierAt(days);
  const todayStatus = completedToday
    ? "protected today"
    : `${formatDuration(remaining)} left today`;

  return (
    <span className="status-badge-wrap">
      <button
        className={`streak-badge ${completedToday ? `is-complete streak-${tier}` : "is-pending"}`}
        type="button"
        aria-label={`${days}-day streak, ${todayStatus}. Show streak rules`}
        aria-describedby={tooltipId}
      >
        <Flame className="streak-flame" size={21} aria-hidden />
        <span>
          <strong>{days}</strong> d
        </span>
      </button>
      <span className="status-tooltip" id={tooltipId} role="tooltip">
        <strong>
          {completedToday
            ? "Today is protected"
            : `${formatDuration(remaining)} left today`}
        </strong>
        <span>
          Track three hours with task timers before your local day ends. Manual
          and corrected entries do not count toward streaks.
        </span>
        <span>An unfinished day without protection resets the streak.</span>
        {nextTier && <span>Next flame color at {nextTier} days.</span>}
      </span>
    </span>
  );
}
