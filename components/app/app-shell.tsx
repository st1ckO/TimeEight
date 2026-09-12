"use client";

import {
  BarChart3,
  CalendarDays,
  Home,
  Pause,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { useTimeEight } from "./app-provider";
import { WebMcpTools } from "./webmcp-tools";

const destinations = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeTimers, pauseAll, profile, syncState, notice, dismissNotice } =
    useTimeEight();
  const initials =
    profile.displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "T8";

  return (
    <div className="app-frame">
      <WebMcpTools />
      <aside className="sidebar">
        <Link className="brand" href="/today" aria-label="Time eIghT home">
          <BrandWordmark />
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
      </aside>

      <main className="main-surface">
        <Link
          className="brand mobile-brand"
          href="/today"
          aria-label="Time eIghT home"
        >
          <BrandWordmark />
        </Link>
        <div className="app-status">
          <span className={`sync-dot ${syncState}`} />
          {syncState === "local" ? "Local demo" : syncState}
        </div>
        {notice && (
          <div className="reconciliation-notice" role="status">
            <span>{notice}</span>
            <button
              className="icon-button"
              onClick={dismissNotice}
              aria-label="Dismiss notice"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {children}
      </main>

      {activeTimers.length > 0 && (
        <div className="active-dock" role="status" aria-live="polite">
          <span className="pulse-dot" aria-hidden="true" />
          <div>
            <strong>Tracking</strong>
            <span>
              {activeTimers.length}{" "}
              {activeTimers.length === 1 ? "timer" : "timers"} active
            </span>
          </div>
          <button
            type="button"
            aria-label="Pause all"
            title="Pause all timers"
            onClick={() => void pauseAll()}
          >
            <Pause size={16} />
            <span>Pause all</span>
          </button>
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
