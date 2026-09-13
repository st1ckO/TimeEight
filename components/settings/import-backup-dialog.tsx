"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Upload, FileJson, AlertTriangle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  backupSchema,
  MAX_BACKUP_BYTES,
  type Backup,
} from "@/lib/domain/backup";

export function ImportBackupDialog({
  onRestore,
  disabled = false,
}: {
  onRestore(backup: Backup): Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"file" | "review" | "confirm">("file");
  const [backup, setBackup] = useState<Backup | null>(null);
  const [filename, setFilename] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [restored, setRestored] = useState(false);
  const selection = useRef(0);
  const pendingRef = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const focusInput = useCallback(
    (input: HTMLInputElement | null) => input?.focus(),
    [],
  );
  function changeOpen(next: boolean) {
    if (pendingRef.current) return;
    selection.current++;
    if (next) setRestored(false);
    setOpen(next);
    setStep("file");
    setBackup(null);
    setFilename("");
    setConfirmation("");
    setError(null);
    setReading(false);
  }
  async function selectFile(file: File | undefined) {
    const token = ++selection.current;
    setBackup(null);
    setReading(false);
    setError(null);
    setFilename(file?.name ?? "");
    if (!file) {
      setReading(false);
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      setError("Choose a JSON backup smaller than 5 MB.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      const parsed = backupSchema.parse(JSON.parse(text));
      if (token === selection.current) setBackup(parsed);
    } catch {
      if (token === selection.current)
        setError(
          "This is not a valid TimeEight JSON backup. Check the file and export version, then try again.",
        );
    } finally {
      if (token === selection.current) setReading(false);
    }
  }
  async function restore(event: React.FormEvent) {
    event.preventDefault();
    if (
      step !== "confirm" ||
      !backup ||
      confirmation !== "CONFIRM" ||
      pendingRef.current
    )
      return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onRestore(backup);
      setOpen(false);
      setRestored(true);
      setBackup(null);
      setConfirmation("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this backup. Please try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Trigger className="secondary-button" disabled={disabled}>
          <Upload size={18} aria-hidden />
          Import JSON
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content account-delete-dialog backup-import-dialog"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancel.current?.focus();
            }}
          >
            <div className="account-delete-icon">
              {step === "file" ? (
                <FileJson size={20} aria-hidden />
              ) : (
                <AlertTriangle size={20} aria-hidden />
              )}
            </div>
            <p className="eyebrow">
              Step {step === "file" ? 1 : step === "review" ? 2 : 3} of 3
            </p>
            <div className="dialog-heading">
              <Dialog.Title>
                {step === "file"
                  ? "Import a backup"
                  : step === "review"
                    ? "Overwrite all current data?"
                    : "Confirm full replacement"}
              </Dialog.Title>
            </div>
            <Dialog.Description className="task-description">
              {step === "file"
                ? "Choose a TimeEight JSON export. Nothing changes until you confirm the overwrite."
                : step === "review"
                  ? "This replaces ALL current settings, tasks, daily goals, and tracked history in this account with the backup. Running timers and queued changes will be discarded. Export your current data first if you want to keep it."
                  : "All current account data will be overwritten. This cannot be undone without another backup. Type CONFIRM to replace it with the selected file."}
            </Dialog.Description>
            <form
              className="account-delete-form"
              onSubmit={(event) => void restore(event)}
            >
              {step === "file" && (
                <label>
                  Backup file
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) =>
                      void selectFile(event.target.files?.[0])
                    }
                    disabled={pending}
                  />
                </label>
              )}
              {backup && (
                <div className="backup-import-preview">
                  <p>{filename}</p>
                  <dl>
                    <div>
                      <dt>Tasks</dt>
                      <dd>{backup.tasks.length}</dd>
                    </div>
                    <div>
                      <dt>History entries</dt>
                      <dd>{backup.entries.length}</dd>
                    </div>
                  </dl>
                  <small>
                    Profile: {backup.profile.displayName || "Unnamed"} ·{" "}
                    {backup.profile.timezone}
                  </small>
                </div>
              )}
              {step === "confirm" && (
                <label>
                  Type CONFIRM to overwrite all data
                  <input
                    ref={focusInput}
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
                {step === "file" ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!backup || reading}
                    onClick={() => setStep("review")}
                  >
                    {reading ? "Reading…" : "Review overwrite"}
                  </button>
                ) : step === "review" ? (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setStep("confirm")}
                  >
                    Replace all data
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="danger-button"
                    disabled={pending || confirmation !== "CONFIRM"}
                  >
                    {pending ? "Restoring…" : "Overwrite and restore"}
                  </button>
                )}
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="backup-import-status" role="status">
        {restored ? "Backup restored. Current data was replaced." : ""}
      </span>
    </>
  );
}
