import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ImportBackupDialog } from "./import-backup-dialog";
const backup = {
  schemaVersion: 1,
  exportedAt: "2026-09-13T12:00:00Z",
  profile: {
    id: "foreign",
    displayName: "Restore",
    timezone: "UTC",
    theme: "system",
    onboardingCompleted: true,
  },
  tasks: [],
  dailyGoals: [],
  entries: [],
};
function file(body: unknown = backup) {
  const result = new File([JSON.stringify(body)], "backup.json", {
    type: "application/json",
  });
  Object.defineProperty(result, "text", {
    value: async () => JSON.stringify(body),
  });
  return result;
}
it("requires review, overwrite acknowledgement, and exact CONFIRM before restore", async () => {
  const user = userEvent.setup();
  const restore = vi.fn().mockResolvedValue(undefined);
  render(<ImportBackupDialog onRestore={restore} />);
  await user.click(screen.getByRole("button", { name: "Import JSON" }));
  await user.upload(
    screen.getByLabelText("Backup file"),
    file({ schemaVersion: 99 }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "not a valid TimeEight",
  );
  expect(
    screen.getByRole("button", { name: "Review overwrite" }),
  ).toBeDisabled();
  await user.upload(screen.getByLabelText("Backup file"), file());
  await user.click(screen.getByRole("button", { name: "Review overwrite" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("ALL current settings");
  expect(restore).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Replace all data" }));
  const input = screen.getByRole("textbox");
  await user.type(input, "confirm");
  expect(
    screen.getByRole("button", { name: "Overwrite and restore" }),
  ).toBeDisabled();
  await user.keyboard("{Enter}");
  expect(restore).not.toHaveBeenCalled();
  await user.clear(input);
  await user.type(input, "CONFIRM");
  await user.click(
    screen.getByRole("button", { name: "Overwrite and restore" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(restore).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Backup restored");
});
it("blocks cancellation while restoring and leaves failed restores available for retry", async () => {
  const user = userEvent.setup();
  let reject: (error: Error) => void = () => {};
  const restore = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  render(<ImportBackupDialog onRestore={restore} />);
  await user.click(screen.getByRole("button", { name: "Import JSON" }));
  await user.upload(screen.getByLabelText("Backup file"), file());
  await user.click(screen.getByRole("button", { name: "Review overwrite" }));
  await user.click(screen.getByRole("button", { name: "Replace all data" }));
  await user.type(screen.getByRole("textbox"), "CONFIRM");
  await user.click(
    screen.getByRole("button", { name: "Overwrite and restore" }),
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(restore).toHaveBeenCalledTimes(1);
  reject(new Error("Remote restore failed"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Remote restore failed",
  );
  expect(
    screen.getByRole("button", { name: "Overwrite and restore" }),
  ).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Import JSON" }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Review overwrite" }),
  ).toBeDisabled();
});
