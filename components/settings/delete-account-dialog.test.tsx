import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DeleteAccountDialog } from "./delete-account-dialog";

it("requires both steps and exact confirmation, and resets after cancellation", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  render(<DeleteAccountDialog onDelete={onDelete} />);
  const trigger = screen.getByRole("button", { name: "Delete account" });
  await user.click(trigger);
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const input = screen.getByLabelText("Type DELETE to confirm");
  expect(input).toHaveFocus();
  await user.type(input, "delete");
  expect(
    screen.getByRole("button", { name: "Delete permanently" }),
  ).toBeDisabled();
  await user.keyboard("{Enter}");
  expect(onDelete).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(trigger);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(onDelete).not.toHaveBeenCalled();
});

it("keeps failed deletion in the popup and permits a confirmed retry", async () => {
  const user = userEvent.setup();
  const onDelete = vi
    .fn()
    .mockRejectedValueOnce(new Error("failed"))
    .mockResolvedValueOnce(undefined);
  render(<DeleteAccountDialog onDelete={onDelete} />);
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(screen.getByRole("textbox"), "DELETE");
  await user.click(screen.getByRole("button", { name: "Delete permanently" }));
  expect(screen.getByRole("alert")).toHaveTextContent("could not be completed");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Delete permanently" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(onDelete).toHaveBeenCalledTimes(2);
});
