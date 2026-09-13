import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimeEight } from "@/components/app/app-provider";
import type { TimeEntry } from "@/lib/domain/types";
import { CalendarPage } from "./calendar-page";

vi.mock("@/components/app/app-provider", () => ({
  useTimeEight: vi.fn(),
}));

const correctedTimer: TimeEntry = {
  id: "timer-entry",
  userId: "user-1",
  taskId: "task-1",
  localDate: "2026-09-12",
  durationSeconds: 1_800,
  source: "timer",
  startedAt: "2026-09-12T01:00:00.000Z",
  endedAt: "2026-09-12T02:00:00.000Z",
  manuallyAdjusted: true,
  correctionOriginalTaskId: "task-1",
  correctionOriginalLocalDate: "2026-09-12",
  correctionOriginalDurationSeconds: 3_600,
  mutationId: "mutation-1",
};

const manualEntry: TimeEntry = {
  ...correctedTimer,
  id: "manual-entry",
  source: "manual",
  startedAt: null,
  endedAt: null,
  correctionOriginalTaskId: null,
  correctionOriginalLocalDate: null,
  correctionOriginalDurationSeconds: null,
  mutationId: "mutation-2",
};

describe("CalendarPage corrections", () => {
  const revertEntryCorrection = vi.fn(async () => undefined);

  beforeEach(() => {
    // jsdom does not implement the browser APIs used by Radix Select.
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    revertEntryCorrection.mockClear();
    vi.mocked(useTimeEight).mockReturnValue({
      today: "2026-09-12",
      entries: [correctedTimer, manualEntry],
      tasks: [
        {
          id: "task-1",
          userId: "user-1",
          name: "Morning walk",
          color: "#197c67",
          goalKind: "minimum",
          targetSeconds: 3_600,
          sortOrder: 0,
          archivedAt: null,
        },
      ],
      totals: new Map([["2026-09-12", 3_600]]),
      dailyGoals: [
        {
          id: "goal-1",
          userId: "user-1",
          effectiveDate: "2026-09-12",
          goalSeconds: 28_800,
        },
      ],
      streak: { protectedDates: [] },
      addEntry: vi.fn(),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
      revertEntryCorrection,
    } as unknown as ReturnType<typeof useTimeEight>);
  });

  it("offers revert only for a corrected timer entry", async () => {
    const user = userEvent.setup();
    render(<CalendarPage />);

    await user.click(
      screen.getAllByRole("button", {
        name: "Entry actions for Morning walk",
      })[0]!,
    );
    const revert = screen.getByRole("menuitem", {
      name: "Restore original time",
    });
    expect(screen.getAllByText("Morning walk")).toHaveLength(2);
    expect(screen.getAllByText("Manual addition")).toHaveLength(1);

    await user.click(revert);

    expect(revertEntryCorrection).toHaveBeenCalledOnce();
    expect(revertEntryCorrection).toHaveBeenCalledWith("timer-entry");
  });

  it("reverses timed history without moving undated manual entries or mutating source entries", async () => {
    const user = userEvent.setup();
    const app = vi.mocked(useTimeEight)();
    const laterTimer = {
      ...correctedTimer,
      id: "later-timer",
      startedAt: "2026-09-12T04:00:00.000Z",
      durationSeconds: 7_200,
    };
    const sourceEntries = [manualEntry, correctedTimer, laterTimer];
    vi.mocked(useTimeEight).mockReturnValue({ ...app, entries: sourceEntries });
    const { container } = render(<CalendarPage />);
    const durations = () =>
      Array.from(
        container.querySelectorAll(".history-entry > strong"),
        (element) => element.textContent,
      );
    expect(durations()).toEqual(["2h 0m", "30m", "30m"]);
    await user.click(
      screen.getByRole("combobox", { name: /History order: Latest first/ }),
    );
    await user.click(screen.getByRole("option", { name: "Oldest first" }));
    expect(durations()).toEqual(["30m", "2h 0m", "30m"]);
    await user.click(
      screen.getByRole("combobox", { name: /History order: Oldest first/ }),
    );
    await user.click(screen.getByRole("option", { name: "Latest first" }));
    expect(durations()).toEqual(["2h 0m", "30m", "30m"]);
    expect(sourceEntries).toEqual([manualEntry, correctedTimer, laterTimer]);
  });

  it("keeps manual and recovered rows compact and confirms deletion", async () => {
    const user = userEvent.setup();
    const app = vi.mocked(useTimeEight)();
    const deleteEntry = vi.fn(async () => undefined);
    vi.mocked(useTimeEight).mockReturnValue({
      ...app,
      deleteEntry,
      entries: [
        manualEntry,
        {
          ...correctedTimer,
          id: "recovered",
          source: "recovered",
          manuallyAdjusted: false,
        },
      ],
    });
    const { container } = render(<CalendarPage />);
    expect(screen.getByText("Recovered")).toHaveAttribute(
      "title",
      "Recovered checkpoint",
    );
    expect(screen.getByText("Manual addition")).toBeInTheDocument();
    for (const row of container.querySelectorAll(".history-entry"))
      expect(row.querySelectorAll("button")).toHaveLength(1);
    await user.click(
      screen.getAllByRole("button", {
        name: "Entry actions for Morning walk",
      })[1]!,
    );
    expect(
      screen.queryByRole("menuitem", { name: "Restore original time" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Delete entry" }));
    expect(
      screen.getByRole("dialog", { name: "Delete tracked entry?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteEntry).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("button", {
        name: "Entry actions for Morning walk",
      })[1]!,
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete entry" }));
    await user.click(screen.getByRole("button", { name: "Delete entry" }));
    expect(deleteEntry).toHaveBeenCalledWith("manual-entry");
  });
});
