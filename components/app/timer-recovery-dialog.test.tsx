import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActiveTimer } from "@/lib/domain/types";
import { TimerRecoveryDialog } from "./timer-recovery-dialog";

const timer: ActiveTimer = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  taskId: "33333333-3333-4333-8333-333333333333",
  startedAt: "2026-09-27T00:00:00.000Z",
  timezone: "UTC",
  accumulatedSeconds: 0,
  checkpointedAt: "2026-09-27T00:03:00.000Z",
  checkpointSeconds: 180,
  limitOverride: false,
  mutationId: "44444444-4444-4444-8444-444444444444",
};

describe("timer recovery choice", () => {
  it("explains the checkpoint and allows the timer to continue", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn().mockResolvedValue(undefined);
    render(
      <TimerRecoveryDialog
        timer={timer}
        taskName="Writing"
        onContinue={onContinue}
        onStopAtCheckpoint={vi.fn()}
      />,
    );

    expect(screen.getByText(/last confirmed checkpoint/i)).toHaveTextContent(
      "3m",
    );
    expect(
      screen.getByRole("button", { name: "Continue timer" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Continue timer" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("keeps the choice open and explains when recovery cannot finish", async () => {
    const user = userEvent.setup();
    const onStop = vi
      .fn()
      .mockRejectedValue(new Error("Reconnect before resolving this timer."));
    render(
      <TimerRecoveryDialog
        timer={timer}
        taskName="Writing"
        onContinue={vi.fn()}
        onStopAtCheckpoint={onStop}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Stop at checkpoint" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Reconnect before resolving this timer.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
