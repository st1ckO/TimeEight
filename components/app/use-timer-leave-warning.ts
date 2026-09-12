"use client";

import { useEffect } from "react";

export function useTimerLeaveWarning(hasActiveTimers: boolean) {
  useEffect(() => {
    if (!hasActiveTimers) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      // Request the browser's own confirmation; do not stop timers here.
      // The user may cancel leaving, and asynchronous saves are not reliable here.
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasActiveTimers]);
}
