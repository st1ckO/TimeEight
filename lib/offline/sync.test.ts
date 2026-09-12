import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/browser";
import { getLocalDatabase } from "./db";
import type { PendingMutation } from "./db";
import { syncPendingMutations } from "./sync";

vi.mock("@/lib/supabase/browser", () => ({ createClient: vi.fn() }));
vi.mock("./db", () => ({ getLocalDatabase: vi.fn() }));

const state: PendingMutation = {
  id: "mutation-1",
  userId: "user-1",
  kind: "task-list-state",
  createdAt: "2026-09-12T01:00:00.000Z",
  payload: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    onDailyList: false,
    archivedAt: null,
  },
};

describe("offline daily-list changes", () => {
  const removeMutation = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const eq = vi.fn();
  const from = vi.fn();
  const sortBy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const result = { error: null };
    const query = {
      update,
      upsert,
      eq,
      then: (resolve: (value: typeof result) => void) => resolve(result),
    };
    update.mockReturnValue(query);
    upsert.mockReturnValue(query);
    eq.mockReturnValue(query);
    from.mockReturnValue(query);
    sortBy.mockResolvedValue([state]);
    vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<
      typeof createClient
    >);
    vi.mocked(getLocalDatabase).mockReturnValue({
      pendingMutations: {
        where: () => ({ equals: () => ({ sortBy }) }),
        delete: removeMutation,
      },
    } as unknown as NonNullable<ReturnType<typeof getLocalDatabase>>);
  });

  it("replays selection as a narrow owner-filtered update", async () => {
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(from).toHaveBeenCalledWith("tasks");
    expect(update).toHaveBeenCalledWith({
      on_daily_list: false,
      archived_at: null,
    });
    expect(eq).toHaveBeenCalledWith("id", state.payload.id);
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(removeMutation).toHaveBeenCalledWith("mutation-1");
  });

  it("keeps malformed selection queued rather than sending it to the server", async () => {
    sortBy.mockResolvedValue([
      { ...state, payload: { ...state.payload, onDailyList: "false" } },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({
      synced: 0,
      error: "Invalid task list state",
    });
    expect(from).not.toHaveBeenCalled();
    expect(removeMutation).not.toHaveBeenCalled();
  });

  it("does not consume queued changes while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 0 });
    expect(removeMutation).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("creates snapshots without overwriting another device's chosen target", async () => {
    const payload = {
      taskId: state.payload.id,
      localDate: "2026-09-12",
      targetSeconds: 1200,
    };
    sortBy.mockResolvedValue([
      { ...state, kind: "task-target-snapshot", payload },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(from).toHaveBeenCalledWith("task_daily_targets");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        task_id: state.payload.id,
        local_date: "2026-09-12",
        target_seconds: 1200,
      },
      { onConflict: "user_id,task_id,local_date", ignoreDuplicates: true },
    );
  });

  it("updates a day's target without touching task defaults", async () => {
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "task-target-upsert",
        payload: {
          taskId: state.payload.id,
          localDate: "2026-09-12",
          targetSeconds: 1200,
        },
      },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ target_seconds: 1200 }),
      expect.objectContaining({ ignoreDuplicates: false }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("sends only requested settings, leaving selection and defaults untouched", async () => {
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "task-settings-update",
        payload: {
          id: state.payload.id,
          name: "Reading",
          goalKind: "minimum",
          color: "#197c67",
        },
      },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(update).toHaveBeenCalledWith({
      name: "Reading",
      goal_kind: "minimum",
      color: "#197c67",
    });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("retains invalid target edits in the queue", async () => {
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "task-target-upsert",
        payload: {
          taskId: state.payload.id,
          localDate: "2026-02-30",
          targetSeconds: 0,
        },
      },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({
      synced: 0,
      error: "Queued change could not be applied",
    });
    expect(from).not.toHaveBeenCalled();
    expect(removeMutation).not.toHaveBeenCalled();
  });
});
