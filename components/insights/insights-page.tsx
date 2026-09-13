"use client";

import { CalendarRange, Clock4, Sparkles, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import { calculateInsights } from "@/lib/domain/insights";
import { formatDuration } from "@/lib/domain/time";

function dateLabel(key: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
}

export function InsightsPage() {
  const app = useTimeEight();
  const insights = useMemo(
    () => calculateInsights(app.entries, app.today),
    [app.entries, app.today],
  );
  const tasks = new Map(app.tasks.map((task) => [task.id, task]));
  const longestSessionDate = app.entries.find(
    (entry) => entry.id === insights.longestSession?.entryId,
  )?.localDate;
  const bestWeek = insights.mostTrackedWeek?.seconds ?? 0;
  const comparison = bestWeek
    ? Math.round((insights.currentWeekSeconds / bestWeek) * 100)
    : 0;
  const maxDay = Math.max(
    ...insights.currentWeekDays.map((day) => day.seconds),
    1,
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Patterns without scores</p>
          <h1>Insights</h1>
          <p>A closer look at how your time adds up.</p>
        </div>
      </header>
      <section className="record-grid" aria-label="Personal time records">
        <article className="record-card">
          <span>
            <Sparkles size={20} />
          </span>
          <p>Most tracked day</p>
          <strong>
            {insights.mostTrackedDay
              ? formatDuration(insights.mostTrackedDay.seconds)
              : "No time yet"}
          </strong>
          <small>
            {insights.mostTrackedDay
              ? dateLabel(insights.mostTrackedDay.date)
              : "Start any timer to build history"}
          </small>
        </article>
        <article className="record-card">
          <span>
            <CalendarRange size={20} />
          </span>
          <p>Most tracked week</p>
          <strong>
            {insights.mostTrackedWeek
              ? formatDuration(insights.mostTrackedWeek.seconds)
              : "No time yet"}
          </strong>
          <small>
            {insights.mostTrackedWeek
              ? `Week of ${dateLabel(insights.mostTrackedWeek.startDate)}`
              : "Monday through Sunday"}
          </small>
        </article>
        <article className="record-card">
          <span>
            <Clock4 size={20} />
          </span>
          <p>Longest session</p>
          <strong>
            {insights.longestSession
              ? formatDuration(insights.longestSession.seconds)
              : "No sessions yet"}
          </strong>
          <small>
            {insights.longestSession
              ? (tasks.get(insights.longestSession.taskId)?.name ??
                "Archived task")
              : "Manual entries count too"}
            {longestSessionDate && ` · ${dateLabel(longestSessionDate)}`}
          </small>
        </article>
      </section>
      <section className="week-panel">
        <div className="week-copy">
          <p className="eyebrow">This Monday–Sunday</p>
          <h2>{formatDuration(insights.currentWeekSeconds)} tracked</h2>
          <p>
            {bestWeek
              ? `That is ${comparison}% of your most tracked week.`
              : "Your first week becomes a useful reference point, not a benchmark."}
          </p>
          <div className="comparison-line">
            <TrendingUp size={18} />
            <span>Best week: {formatDuration(bestWeek)}</span>
          </div>
        </div>
        <div className="week-chart" aria-label="Tracked time by day this week">
          {insights.currentWeekDays.map((day) => (
            <div className="bar-column" key={day.date}>
              <span className="bar-value">
                {day.seconds ? formatDuration(day.seconds) : "0"}
              </span>
              <div className="bar-track">
                <span
                  style={{
                    height: `${Math.max(day.seconds ? 8 : 0, (day.seconds / maxDay) * 100)}%`,
                  }}
                />
              </div>
              <strong>
                {new Intl.DateTimeFormat("en", {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${day.date}T00:00:00Z`))}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
