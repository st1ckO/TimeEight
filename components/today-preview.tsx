"use client";

import {
  BarChart3,
  CalendarDays,
  Flame,
  GripVertical,
  Home,
  Pause,
  Play,
  Plus,
  Settings,
} from "lucide-react";

const tasks = [
  {
    name: "Morning walk",
    kind: "Build time",
    time: "38m",
    target: "of 1h",
    percent: 63,
    color: "#37a889",
    active: false,
  },
  {
    name: "Portfolio project",
    kind: "Build time",
    time: "1h 42m",
    target: "of 3h",
    percent: 57,
    color: "#5577dc",
    active: true,
  },
  {
    name: "Watch list",
    kind: "Limit time",
    time: "43m left",
    target: "1h limit",
    percent: 28,
    color: "#e19a4a",
    active: false,
  },
];

function ProgressRing({ value, size = 176 }: { value: number; size?: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 100) / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-label={`${value}% of daily goal`}
      role="img"
    >
      <circle
        className="ring-track"
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="8"
      />
      <circle
        className="ring-value"
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function TodayPreview() {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="TimeEight home">
          <span>8</span>
          <strong>TimeEight</strong>
        </a>
        <nav aria-label="Primary">
          <a className="nav-item active" href="#today">
            <Home size={20} />
            Today
          </a>
          <a className="nav-item" href="#calendar">
            <CalendarDays size={20} />
            Calendar
          </a>
          <a className="nav-item" href="#insights">
            <BarChart3 size={20} />
            Insights
          </a>
          <a className="nav-item" href="#settings">
            <Settings size={20} />
            Settings
          </a>
        </nav>
        <div className="sidebar-note">
          <span>Time is information.</span>
          <p>No scores. No judgment. Just a clearer day.</p>
        </div>
      </aside>

      <main className="main-surface" id="today">
        <header className="topbar">
          <div>
            <p className="eyebrow">Friday · September 11</p>
            <h1>Good afternoon, Ralph.</h1>
          </div>
          <button className="avatar" aria-label="Open profile">
            RV
          </button>
        </header>

        <section className="today-grid" aria-label="Today's progress">
          <article className="daily-card">
            <div className="ring-wrap">
              <ProgressRing value={36} />
              <div className="ring-copy">
                <strong>2h 52m</strong>
                <span>of 8h</span>
              </div>
            </div>
            <div>
              <p className="eyebrow">Today’s rhythm</p>
              <h2>You’re building a day you can see.</h2>
              <p className="muted">
                Five hours and eight minutes remain in your chosen daily goal.
              </p>
              <div className="streak-line">
                <Flame size={18} />
                <span>
                  <strong>24 minutes</strong> to protect your 6-day streak
                </span>
              </div>
            </div>
          </article>
          <article className="saver-card">
            <div className="shield">◇</div>
            <div>
              <p className="eyebrow">Weekly streak saver</p>
              <h3>Ready when life happens</h3>
              <p>
                Available through Sunday. It will protect your first missed day
                automatically.
              </p>
            </div>
          </article>
        </section>

        <section className="tasks-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reusable daily list</p>
              <h2>Your timers</h2>
            </div>
            <button className="primary-button">
              <Plus size={18} />
              Add task
            </button>
          </div>
          <div className="task-list">
            {tasks.map((task) => (
              <article
                className={`task-card ${task.active ? "is-active" : ""}`}
                key={task.name}
                style={{ "--task-color": task.color } as React.CSSProperties}
              >
                <button
                  className="drag-handle"
                  aria-label={`Reorder ${task.name}`}
                >
                  <GripVertical size={20} />
                </button>
                <span className="task-dot" aria-hidden />
                <div className="task-copy">
                  <div>
                    <h3>{task.name}</h3>
                    <p>{task.kind}</p>
                  </div>
                  <div className="task-progress">
                    <span style={{ width: `${task.percent}%` }} />
                  </div>
                </div>
                <div className="task-time">
                  <strong>{task.time}</strong>
                  <span>{task.target}</span>
                </div>
                <button
                  className={`timer-button ${task.active ? "pause" : ""}`}
                  aria-label={`${task.active ? "Pause" : "Start"} ${task.name}`}
                >
                  {task.active ? (
                    <Pause fill="currentColor" size={20} />
                  ) : (
                    <Play fill="currentColor" size={20} />
                  )}
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className="active-dock">
          <span className="pulse-dot" />
          <div>
            <span>Portfolio project</span>
            <strong>01:42:18</strong>
          </div>
          <button>
            <Pause fill="currentColor" size={18} />
            Pause all
          </button>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Primary mobile navigation">
        <a className="active" href="#today">
          <Home size={21} />
          <span>Today</span>
        </a>
        <a href="#calendar">
          <CalendarDays size={21} />
          <span>Calendar</span>
        </a>
        <a href="#insights">
          <BarChart3 size={21} />
          <span>Insights</span>
        </a>
        <a href="#settings">
          <Settings size={21} />
          <span>Settings</span>
        </a>
      </nav>
    </div>
  );
}
