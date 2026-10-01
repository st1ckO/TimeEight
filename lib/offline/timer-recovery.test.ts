import { describe, expect, it, vi } from "vitest";
import type { ActiveTimer } from "@/lib/domain/types";
import type { TimeEightDatabase } from "./db";
import {
  commitTimerRecovery,
  mergeEntriesById,
  planTimerRecovery,
  remoteTimersNeedingRecovery,
  timerEntryIdentity,
} from "./timer-recovery";

const timer: ActiveTimer = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  taskId: "33333333-3333-4333-8333-333333333333",
  startedAt: "2026-09-26T23:59:00.000Z",
  timezone: "UTC",
  accumulatedSeconds: 0,
  checkpointedAt: "2026-09-27T00:01:00.000Z",
  checkpointSeconds: 120,
  limitOverride: false,
  mutationId: "44444444-4444-4444-8444-444444444444",
};

describe("checkpoint timer recovery", () => {
  it("creates the same entry and mutation IDs on every retry", () => {
    const first = planTimerRecovery(timer, timer.userId, "stop-timer");
    const retry = planTimerRecovery(timer, timer.userId, "stop-timer");

    expect(retry).toEqual(first);
    expect(first.mutations).toHaveLength(1);
    expect(first.mutations[0]).toMatchObject({
      kind: "timer-stop",
      payload: { timerId: timer.id },
    });
    expect(mergeEntriesById(first.entries, retry.entries)).toHaveLength(
      first.entries.length,
    );

    const newerCheckpoint = planTimerRecovery(
      { ...timer, checkpointSeconds: 180 },
      timer.userId,
      "stop-timer",
    );
    expect(newerCheckpoint.entries.map((entry) => entry.id)).toEqual(
      first.entries.map((entry) => entry.id),
    );
    expect(timerEntryIdentity(timer, first.entries[0]!.localDate)).toEqual({
      id: first.entries[0]!.id,
      mutationId: first.entries[0]!.mutationId,
    });
  });

  it("splits recovered time across local midnight without changing the total", () => {
    const plan = planTimerRecovery(timer, timer.userId, "stop-timer");

    expect(plan.entries.map((entry) => entry.localDate)).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(
      plan.entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    ).toBe(timer.checkpointSeconds);
    expect(plan.entries.every((entry) => entry.source === "recovered")).toBe(
      true,
    );
  });

  it("preserves a different remote timer and only queues recovered entries", () => {
    const plan = planTimerRecovery(timer, timer.userId, "preserve-other-timer");

    expect(plan.mutations).toHaveLength(plan.entries.length);
    expect(
      plan.mutations.every((mutation) => mutation.kind === "entry-upsert"),
    ).toBe(true);
  });

  it("quarantines a server-only timer instead of silently continuing it", () => {
    const serverOnly = { ...timer, id: "55555555-5555-4555-8555-555555555555" };

    expect(
      remoteTimersNeedingRecovery([timer, serverOnly], new Set([timer.id])),
    ).toEqual([serverOnly]);
  });

  it("commits the timer removal, entries, and sync mutations together", async () => {
    const plan = planTimerRecovery(timer, timer.userId, "stop-timer");
    const transaction = vi.fn(
      async (
        _mode: string,
        _tables: unknown[],
        operation: () => Promise<void>,
      ) => operation(),
    );
    const db = {
      activeTimers: { delete: vi.fn() },
      timeEntries: { bulkPut: vi.fn() },
      pendingMutations: { bulkDelete: vi.fn(), bulkPut: vi.fn() },
      transaction,
    } as unknown as TimeEightDatabase;

    await commitTimerRecovery(db, timer, plan, ["pending-start"]);

    expect(transaction).toHaveBeenCalledOnce();
    expect(db.pendingMutations.bulkDelete).toHaveBeenCalledWith([
      "pending-start",
    ]);
    expect(db.activeTimers.delete).toHaveBeenCalledWith(timer.id);
    expect(db.timeEntries.bulkPut).toHaveBeenCalledWith(plan.entries);
    expect(db.pendingMutations.bulkPut).toHaveBeenCalledWith(plan.mutations);
  });
});
