"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";

export function ConfirmTaskAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  eyebrow,
  compact = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  eyebrow?: string;
  compact?: boolean;
  onConfirm(): Promise<void>;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      setError("Couldn't save this change. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setError(null);
          onOpenChange(next);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={[
            "dialog-content",
            "task-dialog",
            compact ? "confirm-compact" : "",
          ].join(" ")}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelButton.current?.focus();
          }}
        >
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
          </div>
          <Dialog.Description className="task-description">
            {description}
          </Dialog.Description>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              ref={cancelButton}
              className="secondary-button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </button>
            <button
              className="primary-button form-primary"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending ? "Saving…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
