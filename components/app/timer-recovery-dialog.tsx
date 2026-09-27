"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import type { ActiveTimer } from "@/lib/domain/types";
import { formatDuration } from "@/lib/domain/time";

export function TimerRecoveryDialog({
  timer,
  taskName,
  onContinue,
  onStopAtCheckpoint,
}: {
  timer: ActiveTimer;
  taskName: string;
  onContinue(): Promise<void>;
  onStopAtCheckpoint(): Promise<void>;
}) {
  const continueButton = useRef<HTMLButtonElement>(null);
  const [pendingAction, setPendingAction] = useState<
    "continue" | "stop" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: "continue" | "stop",
    operation: () => Promise<void>,
  ) {
    if (pendingAction) return;
    setPendingAction(action);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't resolve this timer. Please try again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content task-dialog"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            continueButton.current?.focus();
          }}
        >
          <p className="eyebrow">Timer recovery</p>
          <div className="dialog-heading">
            <Dialog.Title>Is “{taskName}” still running?</Dialog.Title>
          </div>
          <Dialog.Description className="task-description">
            TimeEight found this timer in your account, but not on this device.
            It may still be running on another device. Continue keeps the
            original timer running. Stop saves{" "}
            {formatDuration(timer.checkpointSeconds)} through the last confirmed
            checkpoint and ends the timer.
          </Dialog.Description>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              ref={continueButton}
              className="secondary-button"
              disabled={pendingAction !== null}
              onClick={() => void run("continue", onContinue)}
            >
              {pendingAction === "continue" ? "Continuing…" : "Continue timer"}
            </button>
            <button
              className="primary-button form-primary"
              disabled={pendingAction !== null}
              onClick={() => void run("stop", onStopAtCheckpoint)}
            >
              {pendingAction === "stop" ? "Stopping…" : "Stop at checkpoint"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
