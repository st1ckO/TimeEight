"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export function DeleteAccountDialog({
  onDelete,
}: {
  onDelete(): Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"review" | "confirm">("review");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const focusConfirmation = useCallback(
    (input: HTMLInputElement | null) => input?.focus(),
    [],
  );
  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    setStep("review");
    setConfirmation("");
    setError(null);
  }
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (step !== "confirm" || confirmation !== "DELETE" || pending) return;
    setPending(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
      setStep("review");
      setConfirmation("");
    } catch {
      setError("Account deletion could not be completed. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className="danger-button">
        <Trash2 size={18} aria-hidden />
        Delete account
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content account-delete-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
        >
          <div className="account-delete-icon">
            <Trash2 size={20} aria-hidden />
          </div>
          <p className="eyebrow">Step {step === "review" ? "1" : "2"} of 2</p>
          <div className="dialog-heading">
            <Dialog.Title>
              {step === "review"
                ? "Delete your account?"
                : "Confirm account deletion"}
            </Dialog.Title>
          </div>
          <Dialog.Description className="task-description">
            {step === "review"
              ? "Your account, tasks, and tracked history will be permanently deleted. Export a copy first if you want to keep your data."
              : "This cannot be undone. Type DELETE below to confirm that you want to permanently delete your account."}
          </Dialog.Description>
          <form
            className="account-delete-form"
            onSubmit={(event) => void remove(event)}
          >
            {step === "confirm" && (
              <label>
                Type DELETE to confirm
                <input
                  ref={focusConfirmation}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={pending}
                />
              </label>
            )}
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <div className="confirm-actions">
              <button
                ref={cancel}
                type="button"
                className="secondary-button"
                disabled={pending}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </button>
              {step === "review" ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => setStep("confirm")}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  className="danger-button"
                  disabled={confirmation !== "DELETE" || pending}
                >
                  {pending ? "Deleting…" : "Delete permanently"}
                </button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
