import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncStatus } from "./sync-status";

describe("SyncStatus", () => {
  it("shows a concise error detail in the status indicator", () => {
    render(
      <SyncStatus state="error" error="Queued change could not be applied" />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Sync error");
    expect(status).toHaveTextContent("Queued change could not be applied");
  });

  it("does not retain an old error after synchronization recovers", () => {
    const { rerender } = render(
      <SyncStatus state="error" error="Account data could not be loaded." />,
    );

    rerender(<SyncStatus state="synced" error={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("Synced");
    expect(screen.queryByText("Account data could not be loaded.")).toBeNull();
  });
});
