import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeEight } from "./app-provider";
import { TimerDocumentTitle } from "./timer-document-title";
import type { ActiveTimer } from "@/lib/domain/types";

vi.mock("./app-provider", () => ({
  useTimeEight: vi.fn(),
}));

function timer(id: string, startedAt: string): ActiveTimer {
  return {
    id,
    userId: "owner",
    taskId: id,
    startedAt,
    timezone: "UTC",
    accumulatedSeconds: 0,
    checkpointSeconds: 0,
    checkpointedAt: startedAt,
    limitOverride: false,
    mutationId: `${id}-mutation`,
  };
}

function show(activeTimers: ActiveTimer[], now: number) {
  vi.mocked(useTimeEight).mockReturnValue({
    activeTimers,
    now,
  } as ReturnType<typeof useTimeEight>);
}

describe("TimerDocumentTitle", () => {
  beforeEach(() => {
    document.title = "Previous page · TimeEight";
  });

  it("shows the latest timer, advances it, and restores the app title", () => {
    const older = timer("older", "2026-10-05T00:00:00.000Z");
    const newer = timer("newer", "2026-10-05T00:00:50.000Z");
    show([older, newer], Date.parse("2026-10-05T00:01:00.000Z"));

    const view = render(<TimerDocumentTitle />);
    expect(document.title).toBe("0:10 · TimeEight");

    show([older, newer], Date.parse("2026-10-05T00:01:01.000Z"));
    view.rerender(<TimerDocumentTitle />);
    expect(document.title).toBe("0:11 · TimeEight");

    show([older], Date.parse("2026-10-05T00:01:01.000Z"));
    view.rerender(<TimerDocumentTitle />);
    expect(document.title).toBe("1:01 · TimeEight");

    show([], Date.parse("2026-10-05T00:01:01.000Z"));
    view.rerender(<TimerDocumentTitle />);
    expect(document.title).toBe("TimeEight");

    view.unmount();
    expect(document.title).toBe("TimeEight");
  });
});
