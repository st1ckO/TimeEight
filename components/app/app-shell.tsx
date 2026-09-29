"use client";

import { BarChart3, CalendarDays, Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { AppNotification } from "./app-notification";
import { useTimeEight } from "./app-provider";
import { SyncStatus } from "./sync-status";
import { TimerRecoveryDialog } from "./timer-recovery-dialog";
import { WebMcpTools } from "./webmcp-tools";

const destinations = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    activeTimers,
    recoveryTimers,
    tasks,
    profile,
    syncState,
    syncError,
    notice,
    dismissNotice,
    continueRecoveryTimer,
    stopRecoveryTimerAtCheckpoint,
  } = useTimeEight();
  const recoveryTimer = recoveryTimers[0];
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
        <div
          className={`sync-status-position ${syncState === "error" && syncError ? "has-detail" : ""}`}
        >
          <SyncStatus state={syncState} error={syncError} />
        </div>
        {children}
      </main>

      {(notice || (activeTimers.length > 0 && pathname !== "/today")) && (
        <div className="floating-status-stack">
          {notice && (
            <AppNotification
              key={notice.id}
              notice={notice}
              onDismiss={dismissNotice}
            />
          )}
          {activeTimers.length > 0 && pathname !== "/today" && (
            <div className="active-dock" role="status" aria-live="polite">
              <span className="pulse-dot" aria-hidden="true" />
              <div>
                <strong>Tracking</strong>
                <span>
                  {activeTimers.length}{" "}
                  {activeTimers.length === 1 ? "timer" : "timers"} active
                </span>
              </div>
            </div>
          )}
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
      {recoveryTimer && (
        <TimerRecoveryDialog
          key={recoveryTimer.id}
          timer={recoveryTimer}
          taskName={
            tasks.find((task) => task.id === recoveryTimer.taskId)?.name ??
            "this task"
          }
          onContinue={() => continueRecoveryTimer(recoveryTimer.id)}
          onStopAtCheckpoint={() =>
            stopRecoveryTimerAtCheckpoint(recoveryTimer.id)
          }
        />
      )}
    </div>
  );
}
