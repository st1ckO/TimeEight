import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Home,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";

const previewTasks = [
  { name: "Morning walk", meta: "Build time", time: "42m", tone: "teal" },
  {
    name: "Portfolio project",
    meta: "Build time",
    time: "1h 18m",
    tone: "blue",
  },
  { name: "Watch list", meta: "Limit time", time: "34m left", tone: "amber" },
];

export function LandingHeroPreview() {
  return (
    <div
      className="landing-app-preview"
      role="img"
      aria-label="Preview of the TimeEight Today dashboard with daily progress, active timers, and a task list"
    >
      <div className="landing-window-bar" aria-hidden="true">
        <span className="landing-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>Today</span>
        <span className="landing-window-status">
          <i /> Synced
        </span>
      </div>
      <div className="landing-preview-app" aria-hidden="true">
        <aside className="landing-preview-nav">
          <span className="landing-preview-mark">8</span>
          <span className="active">
            <Home size={13} /> Today
          </span>
          <span>
            <CalendarDays size={13} /> Calendar
          </span>
          <span>
            <BarChart3 size={13} /> Insights
          </span>
        </aside>
        <div className="landing-preview-main">
          <div className="landing-preview-heading">
            <div>
              <small>WEDNESDAY, SEPTEMBER 30</small>
              <strong>Good morning, Ralph.</strong>
            </div>
          </div>
          <div className="landing-preview-summary">
            <div className="landing-preview-goal">
              <span className="landing-preview-ring">
                <b>3h 24m</b>
                <small>of 8h</small>
              </span>
              <div>
                <small>TODAY&apos;S RHYTHM</small>
                <b>Make room for what matters.</b>
                <span>4h 36m remain in your daily goal.</span>
              </div>
            </div>
            <div className="landing-preview-active">
              <small>ACTIVE TIMERS</small>
              <b>2 running</b>
              <span>
                <i /> Portfolio project
              </span>
            </div>
          </div>
          <div className="landing-preview-list">
            <div className="landing-preview-list-heading">
              <span>Your timers</span>
              <span>+ Add task</span>
            </div>
            {previewTasks.map((task, index) => (
              <div className="landing-preview-task" key={task.name}>
                <i className={task.tone} />
                <span>
                  <b>{task.name}</b>
                  <small>{task.meta}</small>
                </span>
                <em>{task.time}</em>
                <span
                  className={`landing-preview-control ${index === 1 ? "running" : ""}`}
                >
                  {index === 1 ? <Pause size={11} /> : <Play size={11} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingFeaturePreviews() {
  return (
    <div className="landing-preview-grid">
      <article className="landing-feature-card">
        <div className="landing-feature-heading">
          <span className="landing-feature-icon">
            <Clock3 size={18} />
          </span>
          <div>
            <p className="eyebrow">Today</p>
            <h3>Timers with intention</h3>
          </div>
        </div>
        <p>
          Build time for what you value, or set a gentle daily limit for what
          you want less of.
        </p>
        <div className="landing-mini-timers" aria-hidden="true">
          <div>
            <i className="teal" />
            <span>
              <b>Read</b>
              <small>Build time</small>
            </span>
            <em>56m</em>
            <span className="landing-mini-play">
              <Play size={11} />
            </span>
          </div>
          <div>
            <i className="amber" />
            <span>
              <b>Social media</b>
              <small>Limit time</small>
            </span>
            <em>18m left</em>
            <span className="landing-mini-play amber">
              <Pause size={11} />
            </span>
          </div>
        </div>
      </article>

      <article className="landing-feature-card">
        <div className="landing-feature-heading">
          <span className="landing-feature-icon">
            <CalendarDays size={18} />
          </span>
          <div>
            <p className="eyebrow">Calendar</p>
            <h3>Your time in context</h3>
          </div>
        </div>
        <p>
          Look back by day, review the details, and correct durations without
          turning history into a schedule.
        </p>
        <div className="landing-mini-calendar" aria-hidden="true">
          <div className="landing-mini-calendar-head">
            <b>September</b>
            <span>‹ &nbsp; ›</span>
          </div>
          <div className="landing-mini-weekdays">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="landing-mini-days">
            {[22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5].map(
              (day, index) => (
                <span
                  className={
                    index === 8 ? "selected" : index < 7 ? "tracked" : ""
                  }
                  key={`${day}-${index}`}
                >
                  {day}
                </span>
              ),
            )}
          </div>
        </div>
      </article>

      <article className="landing-feature-card">
        <div className="landing-feature-heading">
          <span className="landing-feature-icon">
            <BarChart3 size={18} />
          </span>
          <div>
            <p className="eyebrow">Insights</p>
            <h3>Patterns without scores</h3>
          </div>
        </div>
        <p>
          See how your tracked time adds up across days and tasks—descriptive,
          never judgmental.
        </p>
        <div className="landing-mini-insights" aria-hidden="true">
          <div className="landing-mini-bars">
            {[42, 68, 51, 84, 63, 76, 58].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="landing-mini-record">
            <span>
              <Flame size={14} /> Current streak
            </span>
            <b>6 days</b>
          </div>
        </div>
      </article>
    </div>
  );
}

export function LandingPrinciples() {
  return (
    <div className="landing-principles">
      <span>
        <Check size={16} /> Different tasks can run together
      </span>
      <span>
        <ShieldCheck size={16} /> Private account history
      </span>
      <span>
        <Clock3 size={16} /> Timestamps keep the truth
      </span>
    </div>
  );
}
