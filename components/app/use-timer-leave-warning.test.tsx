import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTimerLeaveWarning } from "./use-timer-leave-warning";

function requestsConfirmation() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("active timer leave warning", () => {
  it("warns only while at least one timer is active", () => {
    const { rerender } = renderHook(
      ({ count }) => useTimerLeaveWarning(count > 0),
      { initialProps: { count: 0 } },
    );
    expect(requestsConfirmation()).toBe(false);
    rerender({ count: 2 });
    expect(requestsConfirmation()).toBe(true);
    rerender({ count: 1 });
    expect(requestsConfirmation()).toBe(true);
    rerender({ count: 0 });
    expect(requestsConfirmation()).toBe(false);
  });

  it("keeps warning after a canceled departure and cleans up on unmount", () => {
    const { unmount } = renderHook(() => useTimerLeaveWarning(true));
    expect(requestsConfirmation()).toBe(true);
    expect(requestsConfirmation()).toBe(true);
    unmount();
    expect(requestsConfirmation()).toBe(false);
  });
});
