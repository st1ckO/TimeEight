import type { ActiveTimer, TimeEntry } from "@/lib/domain/types";
import { splitDurationAcrossLocalDates } from "@/lib/domain/time";
import type { PendingMutation, TimeEightDatabase } from "@/lib/offline/db";

export type TimerRecoveryMode = "stop-timer" | "preserve-other-timer";

export interface TimerRecoveryPlan {
  entries: TimeEntry[];
  mutations: PendingMutation[];
}

export function mergeEntriesById(current: TimeEntry[], recovered: TimeEntry[]) {
  const merged = new Map(current.map((entry) => [entry.id, entry]));
  recovered.forEach((entry) => merged.set(entry.id, entry));
  return [...merged.values()];
}

export function remoteTimersNeedingRecovery(
  remoteTimers: ActiveTimer[],
  localTimerIds: ReadonlySet<string>,
) {
  return remoteTimers.filter((timer) => !localTimerIds.has(timer.id));
}

function hash32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Recovery IDs must survive a retry. Random IDs would create another history
 * row each time hydration is interrupted and restarted.
 */
export function deterministicRecoveryId(namespace: string, value: string) {
  const input = `${namespace}:${value}`;
  const words = [
    hash32(input, 0x811c9dc5),
    hash32(input, 0x9e3779b9),
    hash32(input, 0x85ebca6b),
    hash32(input, 0xc2b2ae35),
  ];
  const bytes = words.flatMap((word) => [
    (word >>> 24) & 0xff,
    (word >>> 16) & 0xff,
    (word >>> 8) & 0xff,
    word & 0xff,
  ]);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function timerEntryIdentity(
  timer: Pick<ActiveTimer, "id" | "mutationId">,
  localDate: string,
) {
  return {
    id: deterministicRecoveryId(timer.id, `entry:${localDate}`),
    mutationId: deterministicRecoveryId(
      timer.mutationId,
      `entry-mutation:${localDate}`,
    ),
  };
}

export function planTimerRecovery(
  timer: ActiveTimer,
  userId: string,
  mode: TimerRecoveryMode,
): TimerRecoveryPlan {
  const recoveredEnd = new Date(
    Date.parse(timer.startedAt) + timer.checkpointSeconds * 1000,
  ).toISOString();
  const slices =
    timer.checkpointSeconds > 0
      ? splitDurationAcrossLocalDates(
          timer.startedAt,
          recoveredEnd,
          timer.timezone,
        )
      : [];
  const entries = slices.map<TimeEntry>((slice) => {
    // One stable row per timer and local date lets a newer checkpoint replace
    // an uncertain partial retry instead of creating a second history row.
    const sliceKey = slice.localDate;
    const identity = timerEntryIdentity(timer, sliceKey);
    return {
      id: identity.id,
      userId,
      taskId: timer.taskId,
      localDate: slice.localDate,
      durationSeconds: slice.durationSeconds,
      source: "recovered",
      startedAt: slice.startedAt,
      endedAt: slice.endedAt,
      manuallyAdjusted: false,
      correctionOriginalTaskId: null,
      correctionOriginalLocalDate: null,
      correctionOriginalDurationSeconds: null,
      mutationId: identity.mutationId,
    };
  });
  const createdAt = timer.checkpointedAt;
  const mutations: PendingMutation[] =
    mode === "stop-timer"
      ? [
          {
            id: deterministicRecoveryId(timer.mutationId, "timer-stop"),
            userId,
            kind: "timer-stop",
            payload: {
              timerId: timer.id,
              entries: entries as unknown as Record<string, unknown>[],
            },
            createdAt,
          },
        ]
      : entries.map((entry) => ({
          id: deterministicRecoveryId(entry.mutationId, "entry-upsert"),
          userId,
          kind: "entry-upsert" as const,
          payload: entry as unknown as Record<string, unknown>,
          createdAt,
        }));

  return { entries, mutations };
}

export async function commitTimerRecovery(
  db: TimeEightDatabase,
  timer: ActiveTimer,
  plan: TimerRecoveryPlan,
  pendingStartMutationIds: string[],
) {
  await db.transaction(
    "rw",
    [db.activeTimers, db.timeEntries, db.pendingMutations],
    async () => {
      if (pendingStartMutationIds.length > 0)
        await db.pendingMutations.bulkDelete(pendingStartMutationIds);
      await db.activeTimers.delete(timer.id);
      if (plan.entries.length > 0) await db.timeEntries.bulkPut(plan.entries);
      if (plan.mutations.length > 0)
        await db.pendingMutations.bulkPut(plan.mutations);
    },
  );
}
