import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNotification } from "./app-notification";

describe("AppNotification", () => {
  afterEach(() => vi.useRealTimers());

  it("automatically clears routine confirmations", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <AppNotification
        notice={{ id: "notice-1", message: "History refreshed.", tone: "info" }}
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(6_500));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps an error visible until it is dismissed", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <AppNotification
        notice={{
          id: "notice-2",
          message: "History could not be refreshed.",
          tone: "error",
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "History could not be refreshed.",
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
