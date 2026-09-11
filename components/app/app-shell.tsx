"use client";

import { BarChart3, CalendarDays, Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTimeEight } from "./app-provider";

const destinations = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeTimers, pauseAll, profile, syncState } = useTimeEight();
  const initials =
    profile.displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "T8";

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/today" aria-label="TimeEight home">
          <span>8</span>
          <strong>TimeEight</strong>
        </Link>
        <nav aria-label="Primary">
          {destinations.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              className={`nav-item ${pathname === href ? "active" : ""}`}
              href={href}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>Time is information.</span>
          <p>No scores. No judgment. Just a clearer day.</p>
        </div>
      </aside>

      <main className="main-surface">
        <div className="app-status">
          <span className={`sync-dot ${syncState}`} />
          {syncState === "local" ? "Local demo" : syncState}
        </div>
        {children}
      </main>

      {activeTimers.length > 0 && (
        <div className="active-dock">
          <span className="pulse-dot" />
          <div>
            <span>
              {activeTimers.length}{" "}
              {activeTimers.length === 1 ? "timer" : "timers"} active
            </span>
            <strong>Time is being tracked</strong>
          </div>
          <button onClick={() => void pauseAll()}>Pause all</button>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Primary mobile navigation">
        {destinations.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            className={pathname === href ? "active" : ""}
            href={href}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Link
        className="mobile-avatar"
        href="/settings"
        aria-label="Open profile"
      >
        {initials}
      </Link>
    </div>
  );
}
