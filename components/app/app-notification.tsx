"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import type { AppNotice } from "./app-provider";

const icons = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: AlertTriangle,
};

export function AppNotification({
  notice,
  onDismiss,
}: {
  notice: AppNotice;
  onDismiss(): void;
}) {
  const Icon = icons[notice.tone];
  const autoDismissMs =
    notice.tone === "success" ? 4_500 : notice.tone === "info" ? 6_500 : null;

  useEffect(() => {
    if (autoDismissMs === null) return;
    const timeout = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timeout);
  }, [autoDismissMs, notice.id, onDismiss]);

  const urgent = notice.tone === "error";

  return (
    <div
      className={`app-notification ${notice.tone}`}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="app-notification-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <span className="app-notification-message">{notice.message}</span>
      <button
        className="app-notification-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
