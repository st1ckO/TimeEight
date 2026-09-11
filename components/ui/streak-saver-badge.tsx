"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { useId } from "react";
import { nextSaverResetDate } from "@/lib/domain/streak";

function dateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day)));
}

export function StreakSaverBadge({
  available,
  consumedDate,
  today,
  timezone,
}: {
  available: boolean;
  consumedDate: string | null;
  today: string;
  timezone: string;
}) {
  const tooltipId = useId();
  const resetDate = nextSaverResetDate(today);
  const resetLabel = `${dateLabel(resetDate)} at 12:00 AM (${timezone})`;
  const consumedLabel = consumedDate ? dateLabel(consumedDate) : null;

  return (
    <span className="status-badge-wrap saver-badge-wrap">
      <button
        className={`saver-badge ${available ? "is-available" : "is-used"}`}
        type="button"
        aria-label={
          available
            ? "Weekly streak saver available. Show saver rules"
            : `Weekly streak saver used. Resets ${resetLabel}. Show saver rules`
        }
        aria-describedby={tooltipId}
      >
        {available ? (
          <ShieldCheck size={22} aria-hidden />
        ) : (
          <ShieldX size={22} aria-hidden />
        )}
      </button>
      <span className="status-tooltip" id={tooltipId} role="tooltip">
        <strong>{available ? "Saver available" : "Saver used"}</strong>
        <span>
          It automatically protects the first missed day each Monday–Sunday.
          Savers do not accumulate.
        </span>
        {available ? (
          <span>Unused protection renews {resetLabel}.</span>
        ) : (
          <span>
            {consumedLabel ? `Used ${consumedLabel}. ` : ""}Resets {resetLabel}.
            Another missed day before then resets the streak.
          </span>
        )}
      </span>
    </span>
  );
}
