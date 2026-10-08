import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/browser";
import { getLocalDatabase } from "./db";
import type { PendingMutation } from "./db";
import {
  checkpointRemoteTimer,
  loadRemoteActiveTimers,
  loadRemoteEntries,
  syncPendingMutations,
} from "./sync";

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
  const select = vi.fn();
  const rpc = vi.fn();
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
      select,
      eq,
      then: (resolve: (value: typeof result) => void) => resolve(result),
    };
    update.mockReturnValue(query);
    upsert.mockReturnValue(query);
    select.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    eq.mockReturnValue(query);
    from.mockReturnValue(query);
    sortBy.mockResolvedValue([state]);
    vi.mocked(createClient).mockReturnValue({
      from,
      rpc,
    } as unknown as ReturnType<typeof createClient>);
    vi.mocked(getLocalDatabase).mockReturnValue({
      profiles: { get: vi.fn().mockResolvedValue({ timezone: "Asia/Manila" }) },
      pendingMutations: {
        where: () => ({ equals: () => ({ sortBy }) }),
        delete: removeMutation,
      },
    } as unknown as NonNullable<ReturnType<typeof getLocalDatabase>>);
  });

  it("preserves legacy queued historical goal snapshots", async () => {
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "goal-upsert",
        payload: {
          id: "goal-1",
          userId: "user-1",
          effectiveDate: "2000-01-01",
          goalSeconds: 14400,
        },
      },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ goal_seconds: 14400 }),
      { onConflict: "user_id,effective_date" },
    );
  });

  it("normalizes legacy queued custom goals to eight hours", async () => {
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "goal-upsert",
        payload: {
          id: "goal-1",
          userId: "user-1",
          effectiveDate: "2099-09-13",
          goalSeconds: 3600,
        },
      },
    ]);
    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ goal_seconds: 28_800 }),
      { onConflict: "user_id,effective_date" },
    );
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

  it("checks whether a checkpointed timer still exists remotely", async () => {
    const timer = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "user-1",
      taskId: state.payload.id as string,
      startedAt: "2026-09-29T01:00:00.000Z",
      timezone: "Asia/Manila",
      accumulatedSeconds: 0,
      checkpointedAt: "2026-09-29T01:01:00.000Z",
      checkpointSeconds: 60,
      limitOverride: false,
      mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };

    expect(await checkpointRemoteTimer(timer)).toEqual({
      data: [],
      error: null,
    });
    expect(update).toHaveBeenCalledWith({
      checkpointed_at: timer.checkpointedAt,
      checkpoint_seconds: timer.checkpointSeconds,
    });
    expect(eq).toHaveBeenCalledWith("id", timer.id);
    expect(eq).toHaveBeenCalledWith("user_id", timer.userId);
    expect(select).toHaveBeenCalledWith("id");
  });

  it("loads only owner-filtered timers for routine reconciliation", async () => {
    const ownerFilter = vi.fn().mockResolvedValue({
      data: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          user_id: "user-1",
          task_id: state.payload.id,
          started_at: "2026-09-29T01:00:00.000Z",
          timezone: "Asia/Manila",
          accumulated_seconds: 0,
          checkpointed_at: "2026-09-29T01:01:00.000Z",
          checkpoint_seconds: 60,
          limit_override: false,
          mutation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        },
      ],
      error: null,
    });
    select.mockReturnValueOnce({ eq: ownerFilter });

    expect(await loadRemoteActiveTimers("user-1")).toEqual([
      expect.objectContaining({
        userId: "user-1",
        checkpointSeconds: 60,
      }),
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("active_timers");
    expect(select).toHaveBeenCalledWith("*");
    expect(ownerFilter).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("loads owner-filtered history only when reconciliation needs it", async () => {
    const ownerFilter = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          user_id: "user-1",
          task_id: state.payload.id,
          local_date: "2026-09-29",
          duration_seconds: 60,
          source: "timer",
          started_at: "2026-09-29T01:00:00.000Z",
          ended_at: "2026-09-29T01:01:00.000Z",
          manually_adjusted: false,
          correction_original_task_id: null,
          correction_original_local_date: null,
          correction_original_duration_seconds: null,
          mutation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        },
      ],
      error: null,
    });
    select.mockReturnValueOnce({ eq: ownerFilter });

    expect(await loadRemoteEntries("user-1")).toEqual([
      expect.objectContaining({
        userId: "user-1",
        durationSeconds: 60,
      }),
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("time_entries");
    expect(select).toHaveBeenCalledWith("*");
    expect(ownerFilter).toHaveBeenCalledWith("user_id", "user-1");
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

  it("repairs a queued target that raced ahead of its new task", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    sortBy.mockResolvedValue([
      {
        ...state,
        id: "target-mutation",
        userId,
        kind: "task-target-snapshot",
        payload: {
          taskId,
          localDate: "2026-09-29",
          targetSeconds: 3600,
        },
      },
      {
        ...state,
        id: "task-mutation",
        userId,
        kind: "task-upsert",
        payload: {
          id: taskId,
          userId,
          name: "Test",
          color: "#197c67",
          goalKind: "limit",
          targetSeconds: 3600,
          sortOrder: 0,
          archivedAt: null,
          onDailyList: true,
        },
      },
    ]);

    expect(await syncPendingMutations(userId)).toEqual({ synced: 2 });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "tasks",
      "task_daily_targets",
    ]);
    expect(removeMutation.mock.calls.map(([id]) => id)).toEqual([
      "task-mutation",
      "target-mutation",
    ]);
  });

  it("atomically stops a timer instead of inserting entries before deletion", async () => {
    const timerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const entry = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      userId: "user-1",
      taskId: state.payload.id,
      localDate: "2026-09-29",
      durationSeconds: 60,
      source: "timer",
      startedAt: "2026-09-29T01:00:00.000Z",
      endedAt: "2026-09-29T01:01:00.000Z",
      manuallyAdjusted: false,
      correctionOriginalTaskId: null,
      correctionOriginalLocalDate: null,
      correctionOriginalDurationSeconds: null,
      mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "timer-stop",
        payload: { timerId, entries: [entry] },
      },
    ]);

    expect(await syncPendingMutations("user-1")).toEqual({ synced: 1 });
    expect(rpc).toHaveBeenCalledWith("stop_active_timer", {
      p_timer_id: timerId,
      p_entries: [
        {
          id: entry.id,
          user_id: entry.userId,
          task_id: entry.taskId,
          local_date: entry.localDate,
          duration_seconds: entry.durationSeconds,
          source: entry.source,
          started_at: entry.startedAt,
          ended_at: entry.endedAt,
          manually_adjusted: false,
          correction_original_task_id: null,
          correction_original_local_date: null,
          correction_original_duration_seconds: null,
          mutation_id: entry.mutationId,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
    expect(removeMutation).toHaveBeenCalledWith("mutation-1");
  });

  it("consumes a second-device stop after the server reports it already won", async () => {
    const supersededEntryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    rpc.mockResolvedValue({ data: false, error: null });
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "timer-stop",
        payload: {
          timerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          entries: [{ id: supersededEntryId }],
        },
      },
    ]);

    expect(await syncPendingMutations("user-1")).toEqual({
      synced: 1,
      supersededEntryIds: [supersededEntryId],
    });
    expect(removeMutation).toHaveBeenCalledWith("mutation-1");
  });

  it("reports a superseded stop even when a later queued change fails", async () => {
    const supersededEntryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    rpc.mockResolvedValue({ data: false, error: null });
    sortBy.mockResolvedValue([
      {
        ...state,
        kind: "timer-stop",
        payload: {
          timerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          entries: [{ id: supersededEntryId }],
        },
      },
      {
        ...state,
        id: "invalid-target",
        kind: "task-target-upsert",
        payload: {
          taskId: state.payload.id,
          localDate: "2026-02-30",
          targetSeconds: 0,
        },
      },
    ]);

    expect(await syncPendingMutations("user-1")).toEqual({
      synced: 1,
      error: "Queued change could not be applied",
      supersededEntryIds: [supersededEntryId],
    });
    expect(removeMutation).toHaveBeenCalledWith("mutation-1");
    expect(removeMutation).not.toHaveBeenCalledWith("invalid-target");
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
