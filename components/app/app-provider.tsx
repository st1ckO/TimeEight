"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ActiveTimer,
  DailyGoalChange,
  GoalKind,
  Profile,
  Task,
  TaskDailyTarget,
  ThemePreference,
  TimeEntry,
} from "@/lib/domain/types";
import {
  correctTimeEntry,
  revertTimeEntryCorrection,
} from "@/lib/domain/corrections";
import {
  aggregateEntries,
  elapsedSeconds,
  elapsedSecondsForDate,
  localDateAt,
  splitDurationAcrossLocalDates,
} from "@/lib/domain/time";
import { aggregateStreakEntries, calculateStreak } from "@/lib/domain/streak";
import { useTimerLeaveWarning } from "./use-timer-leave-warning";
import {
  taskSchema,
  taskListStateSchema,
  taskDailyTargetSchema,
} from "@/lib/domain/schemas";
import {
  taskTargetForDate,
  taskTargetId,
  missingTaskTargets,
  allotmentStopsTimer,
} from "@/lib/domain/task-targets";
import {
  archiveSavedTask,
  dailyTasks,
  nextTaskOrder,
  normalizeTask,
  removeFromDailyList,
  restoreSavedTask,
} from "@/lib/domain/task-list";
import {
  clearLocalUser,
  getLocalDatabase,
  type LocalProfile,
  type PendingMutation,
} from "@/lib/offline/db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  checkpointRemoteTimer,
  loadRemoteSnapshot,
  syncPendingMutations,
} from "@/lib/offline/sync";

const palette = ["#197c67", "#5577dc", "#d58c33", "#a45cc4", "#d86464"];

function todayKey(timezone: string) {
  return localDateAt(Date.now(), timezone);
}

function newId() {
  return crypto.randomUUID();
}

interface AddTaskInput {
  name: string;
  goalKind: GoalKind;
  targetSeconds: number;
  color?: string;
}
interface EntryInput {
  taskId: string;
  localDate: string;
  durationSeconds: number;
}

interface AppContextValue {
  userId: string;
  profile: LocalProfile;
  dailyGoals: DailyGoalChange[];
  tasks: Task[];
  taskDailyTargets: TaskDailyTarget[];
  activeTimers: ActiveTimer[];
  entries: TimeEntry[];
  now: number;
  hydrated: boolean;
  syncState: "local" | "synced" | "pending" | "offline" | "error";
  notice: string | null;
  today: string;
  totals: Map<string, number>;
  streakTotals: Map<string, number>;
  streak: ReturnType<typeof calculateStreak>;
  addTask(input: AddTaskInput): Promise<void>;
  updateTask(id: string, input: AddTaskInput): Promise<void>;
  updateTodayTask(
    id: string,
    input: AddTaskInput,
    options: {
      localDate: string;
      useAsDefault?: boolean;
      confirmStop?: boolean;
    },
  ): Promise<void>;
  archiveTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  addTaskToDailyList(id: string, targetSeconds?: number): Promise<void>;
  removeTaskFromDailyList(id: string): Promise<void>;
  reorderTasks(ids: string[]): Promise<void>;
  startTimer(taskId: string, limitOverride?: boolean): Promise<void>;
  pauseTimer(
    taskId: string,
    recovered?: boolean,
    preserveElapsed?: boolean,
  ): Promise<void>;
  pauseAll(): Promise<void>;
  addEntry(input: EntryInput): Promise<void>;
  updateEntry(id: string, input: EntryInput): Promise<void>;
  revertEntryCorrection(id: string): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  updateProfile(input: {
    displayName: string;
    timezone: string;
    theme: ThemePreference;
    onboardingCompleted?: boolean;
  }): Promise<void>;
  updateDailyGoal(goalSeconds: number): Promise<void>;
  clearUserData(): Promise<void>;
  dismissNotice(): void;
}

const AppContext = createContext<AppContextValue | null>(null);

function seedTasks(userId: string): Task[] {
  return [
    {
      id: newId(),
      userId,
      name: "Morning walk",
      color: palette[0]!,
      goalKind: "minimum",
      targetSeconds: 3600,
      sortOrder: 0,
      archivedAt: null,
      onDailyList: true,
    },
    {
      id: newId(),
      userId,
      name: "Portfolio project",
      color: palette[1]!,
      goalKind: "minimum",
      targetSeconds: 10_800,
      sortOrder: 1,
      archivedAt: null,
      onDailyList: true,
    },
    {
      id: newId(),
      userId,
      name: "Watch list",
      color: palette[2]!,
      goalKind: "limit",
      targetSeconds: 3600,
      sortOrder: 2,
      archivedAt: null,
      onDailyList: true,
    },
  ];
}

function addActiveTimerTotals(
  totals: Map<string, number>,
  activeTimers: ActiveTimer[],
  now: number,
) {
  for (const timer of activeTimers) {
    const slices = splitDurationAcrossLocalDates(
      timer.startedAt,
      new Date(now).toISOString(),
      timer.timezone,
    );
    for (const slice of slices) {
      totals.set(
        slice.localDate,
        (totals.get(slice.localDate) ?? 0) + slice.durationSeconds,
      );
    }
  }
  return totals;
}

async function queue(
  userId: string,
  kind: PendingMutation["kind"],
  payload: Record<string, unknown>,
) {
  const db = getLocalDatabase();
  if (!db || userId === "local-demo") return;
  await db.pendingMutations.put({
    id: newId(),
    userId,
    kind,
    payload,
    createdAt: new Date().toISOString(),
  });
}

export function AppProvider({
  userId,
  initialProfile,
  initialAccountStart,
  children,
}: {
  userId: string;
  initialProfile: Profile;
  initialAccountStart: string;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<LocalProfile>({
    ...initialProfile,
    accountStart: initialAccountStart,
  });
  const [dailyGoals, setDailyGoals] = useState<DailyGoalChange[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDailyTargets, setTaskDailyTargets] = useState<TaskDailyTarget[]>(
    [],
  );
  const targetsRef = useRef<TaskDailyTarget[]>([]);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  useTimerLeaveWarning(activeTimers.length > 0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<AppContextValue["syncState"]>(
    userId === "local-demo" ? "local" : "pending",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const activeRef = useRef(activeTimers);

  useEffect(() => {
    activeRef.current = activeTimers;
  }, [activeTimers]);

  useEffect(() => {
    document.documentElement.dataset.theme =
      profile.theme === "system" ? "" : profile.theme;
  }, [profile.theme]);

  const persistMutation = useCallback(
    async (kind: PendingMutation["kind"], payload: Record<string, unknown>) => {
      await queue(userId, kind, payload);
      if (userId === "local-demo") return;
      if (!navigator.onLine) return setSyncState("offline");
      setSyncState("pending");
      const result = await syncPendingMutations(userId);
      setSyncState(result.error ? "error" : "synced");
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const db = getLocalDatabase();
      if (!db) return setHydrated(true);
      let storedProfile = (await db.profiles.get(userId)) ?? {
        ...initialProfile,
        accountStart: initialAccountStart,
      };
      if (cancelled) return;
      let storedGoals = await db.dailyGoals
        .where("userId")
        .equals(userId)
        .toArray();
      let storedTasks = await db.tasks.where("userId").equals(userId).toArray();
      let storedTargets = await db.taskDailyTargets
        .where("userId")
        .equals(userId)
        .toArray();
      const storedTimers = await db.activeTimers
        .where("userId")
        .equals(userId)
        .toArray();
      let storedEntries = await db.timeEntries
        .where("userId")
        .equals(userId)
        .toArray();
      if (cancelled) return;
      const onlineAccount =
        isSupabaseConfigured() && userId !== "local-demo" && navigator.onLine;
      let remoteBefore: Awaited<ReturnType<typeof loadRemoteSnapshot>> | null =
        null;

      if (onlineAccount) {
        try {
          remoteBefore = await loadRemoteSnapshot(userId);
        } catch {
          setSyncState("error");
        }
      }

      if (cancelled) return;

      const recoveredEntries: TimeEntry[] = storedTimers.flatMap((timer) => {
        if (timer.checkpointSeconds <= 0) return [];
        const recoveredEnd = new Date(
          Date.parse(timer.startedAt) + timer.checkpointSeconds * 1000,
        ).toISOString();
        return splitDurationAcrossLocalDates(
          timer.startedAt,
          recoveredEnd,
          timer.timezone,
        ).map((slice) => ({
          id: newId(),
          userId,
          taskId: timer.taskId,
          localDate: slice.localDate,
          durationSeconds: slice.durationSeconds,
          source: "recovered" as const,
          startedAt: slice.startedAt,
          endedAt: slice.endedAt,
          manuallyAdjusted: false,
          correctionOriginalTaskId: null,
          correctionOriginalLocalDate: null,
          correctionOriginalDurationSeconds: null,
          mutationId: newId(),
        }));
      });

      for (const timer of storedTimers) {
        const timerEntries = recoveredEntries.filter(
          (entry) => entry.taskId === timer.taskId,
        );
        const remoteTimer = remoteBefore?.activeTimers.find(
          (item) => item.taskId === timer.taskId,
        );
        await db.pendingMutations
          .filter(
            (mutation) =>
              mutation.kind === "timer-start" &&
              mutation.payload.id === timer.id,
          )
          .delete();
        if (remoteTimer && remoteTimer.id !== timer.id) {
          for (const entry of timerEntries)
            await queue(
              userId,
              "entry-upsert",
              entry as unknown as Record<string, unknown>,
            );
          setNotice(
            "Time from an offline timer was recovered. The timer already active on another device remains active.",
          );
        } else {
          await queue(userId, "timer-stop", {
            timerId: timer.id,
            entries: timerEntries as unknown as Record<string, unknown>[],
          });
        }
      }
      if (storedTimers.length > 0) {
        await db.activeTimers.bulkDelete(storedTimers.map((timer) => timer.id));
        if (recoveredEntries.length > 0)
          await db.timeEntries.bulkPut(recoveredEntries);
        storedEntries = [...storedEntries, ...recoveredEntries];
      }

      // Never replace unsynced local edits with a stale server snapshot.
      let remoteAfter: Awaited<ReturnType<typeof loadRemoteSnapshot>> | null =
        null;
      if (onlineAccount) {
        const result = await syncPendingMutations(userId);
        setSyncState(result.error ? "error" : "synced");
        if (!result.error) {
          try {
            remoteAfter = await loadRemoteSnapshot(userId);
          } catch {
            setSyncState("error");
          }
        }
      }

      if (remoteAfter) {
        storedProfile = remoteAfter.profile;
        storedGoals = remoteAfter.dailyGoals;
        storedTasks = remoteAfter.tasks;
        storedTargets = remoteAfter.taskDailyTargets;
        storedEntries = remoteAfter.entries;
      }
      if (cancelled) return;
      if (storedGoals.length === 0) {
        const goal = {
          id: newId(),
          userId,
          effectiveDate: todayKey(storedProfile.timezone),
          goalSeconds: 28_800,
        };
        storedGoals = [goal];
        await queue(
          userId,
          "goal-upsert",
          goal as unknown as Record<string, unknown>,
        );
      }
      if (storedTasks.length === 0) {
        storedTasks = seedTasks(userId);
        for (const task of storedTasks)
          await queue(
            userId,
            "task-upsert",
            task as unknown as Record<string, unknown>,
          );
      }

      storedTasks = storedTasks.map(normalizeTask);
      const newTargets = missingTaskTargets(storedTasks, storedTargets, [
        ...storedEntries,
        ...dailyTasks(storedTasks).map((task) => ({
          taskId: task.id,
          localDate: todayKey(storedProfile.timezone),
        })),
      ]);
      storedTargets = [...storedTargets, ...newTargets];
      for (const target of newTargets)
        await queue(userId, "task-target-snapshot", { ...target });
      if (cancelled) return;
      // Readers must not observe an empty list between delete and replacement.
      await db.transaction(
        "rw",
        [
          db.profiles,
          db.dailyGoals,
          db.tasks,
          db.taskDailyTargets,
          db.activeTimers,
          db.timeEntries,
        ],
        async () => {
          await db.profiles.put(storedProfile);
          await db.dailyGoals.where("userId").equals(userId).delete();
          await db.tasks.where("userId").equals(userId).delete();
          await db.taskDailyTargets.where("userId").equals(userId).delete();
          await db.activeTimers.where("userId").equals(userId).delete();
          await db.timeEntries.where("userId").equals(userId).delete();
          if (storedGoals.length > 0) await db.dailyGoals.bulkPut(storedGoals);
          if (storedTasks.length > 0) await db.tasks.bulkPut(storedTasks);
          if (storedTargets.length > 0)
            await db.taskDailyTargets.bulkPut(storedTargets);
          if (remoteAfter?.activeTimers.length)
            await db.activeTimers.bulkPut(remoteAfter.activeTimers);
          if (storedEntries.length > 0)
            await db.timeEntries.bulkPut(storedEntries);
        },
      );
      if (cancelled) return;
      setProfile(storedProfile);
      setDailyGoals(storedGoals);
      setTasks(storedTasks.sort((a, b) => a.sortOrder - b.sortOrder));
      targetsRef.current = storedTargets;
      setTaskDailyTargets(storedTargets);
      setActiveTimers(remoteAfter?.activeTimers ?? []);
      setEntries(storedEntries);
      setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialAccountStart, initialProfile, userId]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const pauseTimer = useCallback(
    async (taskId: string, recovered = false, preserveElapsed = false) => {
      const timer = activeRef.current.find((item) => item.taskId === taskId);
      if (!timer) return;
      const endedAt = new Date().toISOString();
      const task = tasks.find((item) => item.id === taskId);
      const duration = elapsedSeconds(timer, Date.parse(endedAt));
      const slices = splitDurationAcrossLocalDates(
        timer.startedAt,
        new Date(Date.parse(timer.startedAt) + duration * 1000).toISOString(),
        timer.timezone,
      ).flatMap((slice) => {
        if (
          !task ||
          task.goalKind !== "limit" ||
          timer.limitOverride ||
          preserveElapsed
        )
          return [slice];
        const previous = entries
          .filter(
            (entry) =>
              entry.taskId === taskId && entry.localDate === slice.localDate,
          )
          .reduce((sum, entry) => sum + entry.durationSeconds, 0);
        const seconds = Math.min(
          slice.durationSeconds,
          Math.max(
            0,
            taskTargetForDate(task, targetsRef.current, slice.localDate) -
              previous,
          ),
        );
        return seconds > 0
          ? [
              {
                ...slice,
                durationSeconds: seconds,
                endedAt: new Date(
                  Date.parse(slice.startedAt) + seconds * 1000,
                ).toISOString(),
              },
            ]
          : [];
      });
      const newEntries: TimeEntry[] = slices.map((slice) => ({
        id: newId(),
        userId,
        taskId,
        localDate: slice.localDate,
        durationSeconds: slice.durationSeconds,
        source: recovered ? "recovered" : "timer",
        startedAt: slice.startedAt,
        endedAt: slice.endedAt,
        manuallyAdjusted: false,
        correctionOriginalTaskId: null,
        correctionOriginalLocalDate: null,
        correctionOriginalDurationSeconds: null,
        mutationId: newId(),
      }));
      activeRef.current = activeRef.current.filter(
        (item) => item.id !== timer.id,
      );
      setActiveTimers((current) =>
        current.filter((item) => item.id !== timer.id),
      );
      setEntries((current) => [...current, ...newEntries]);
      const db = getLocalDatabase();
      if (db)
        await db.transaction(
          "rw",
          [db.activeTimers, db.timeEntries],
          async () => {
            await db.activeTimers.delete(timer.id);
            await db.timeEntries.bulkPut(newEntries);
          },
        );
      await persistMutation("timer-stop", {
        timerId: timer.id,
        entries: newEntries as unknown as Record<string, unknown>[],
      });
    },
    [entries, persistMutation, tasks, userId],
  );

  const pauseAll = useCallback(async () => {
    for (const timer of [...activeRef.current]) await pauseTimer(timer.taskId);
  }, [pauseTimer]);

  useEffect(() => {
    const onPageHide = () => {
      const timerIds = activeRef.current.map((timer) => timer.id);
      if (timerIds.length > 0 && userId !== "local-demo") {
        void fetch("/api/timers/pause", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ timerIds }),
          keepalive: true,
        });
      }
      void pauseAll();
    };
    const onOnline = () => {
      if (userId !== "local-demo")
        void syncPendingMutations(userId).then((result) =>
          setSyncState(result.error ? "error" : "synced"),
        );
    };
    const onOffline = () => userId !== "local-demo" && setSyncState("offline");
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [pauseAll, userId]);

  useEffect(() => {
    const db = getLocalDatabase();
    if (!db || activeTimers.length === 0) return;
    const checkpoint = window.setInterval(() => {
      const checkpointedAt = new Date().toISOString();
      const next = activeRef.current.map((timer) => ({
        ...timer,
        checkpointedAt,
        checkpointSeconds: elapsedSeconds(timer),
      }));
      setActiveTimers(next);
      void db.activeTimers.bulkPut(next);
      if (
        isSupabaseConfigured() &&
        userId !== "local-demo" &&
        navigator.onLine
      ) {
        for (const timer of next) void checkpointRemoteTimer(timer);
      }
    }, 15_000);
    return () => window.clearInterval(checkpoint);
  }, [activeTimers.length, userId]);

  async function addTask(input: AddTaskInput) {
    const parsed = taskSchema.parse({
      ...input,
      color: input.color ?? palette[tasks.length % palette.length]!,
    });
    const task: Task = {
      id: newId(),
      userId,
      ...parsed,
      sortOrder: nextTaskOrder(tasks),
      archivedAt: null,
      onDailyList: true,
    };
    setTasks((current) => [...current, task]);
    await getLocalDatabase()?.tasks.put(task);
    await persistMutation(
      "task-upsert",
      task as unknown as Record<string, unknown>,
    );
    await ensureTaskTargets(
      [task],
      [{ taskId: task.id, localDate: todayKey(profile.timezone) }],
    );
  }

  const ensureTaskTargets = useCallback(
    async (
      sourceTasks: Task[],
      choices: { taskId: string; localDate: string }[],
    ) => {
      const missing = missingTaskTargets(
        sourceTasks,
        targetsRef.current,
        choices,
      );
      if (!missing.length) return;
      // Update the ref before awaiting so a second action cannot seed duplicates.
      targetsRef.current = [...targetsRef.current, ...missing];
      try {
        await getLocalDatabase()?.taskDailyTargets.bulkPut(missing);
      } catch (cause) {
        const failedIds = new Set(missing.map((target) => target.id));
        targetsRef.current = targetsRef.current.filter(
          (target) => !failedIds.has(target.id),
        );
        throw cause;
      }
      setTaskDailyTargets(targetsRef.current);
      for (const target of missing)
        await persistMutation("task-target-snapshot", { ...target });
    },
    [persistMutation],
  );

  const targetDate = todayKey(profile.timezone);
  useEffect(() => {
    if (!hydrated) return;
    void ensureTaskTargets(
      tasks,
      dailyTasks(tasks).map((task) => ({
        taskId: task.id,
        localDate: targetDate,
      })),
    ).catch(() =>
      setNotice(
        "Couldn't save today's allotments. Please reload and try again.",
      ),
    );
  }, [ensureTaskTargets, hydrated, targetDate, tasks]);

  async function updateTask(id: string, input: AddTaskInput) {
    const existing = tasks.find((task) => task.id === id);
    if (!existing) return;
    await ensureTaskTargets(
      [existing],
      [
        ...entries.filter((entry) => entry.taskId === id),
        { taskId: id, localDate: todayKey(profile.timezone) },
      ],
    );
    const parsed = taskSchema.parse({
      ...input,
      color: input.color ?? existing.color,
    });
    const next = {
      ...existing,
      ...parsed,
    };
    setTasks((current) =>
      current.map((task) => (task.id === id ? next : task)),
    );
    await getLocalDatabase()?.tasks.put(next);
    await persistMutation("task-settings-update", { id, ...parsed });
  }

  async function updateTodayTask(
    id: string,
    input: AddTaskInput,
    options: {
      localDate: string;
      useAsDefault?: boolean;
      confirmStop?: boolean;
    },
  ) {
    const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("Task not found");
    const localDate = todayKey(profile.timezone);
    if (options.localDate !== localDate)
      throw new Error("The day changed. Reopen the editor for today.");
    const parsed = taskSchema.parse({
      ...input,
      color: input.color ?? task.color,
    });
    taskDailyTargetSchema.parse({
      taskId: id,
      localDate,
      targetSeconds: parsed.targetSeconds,
    });
    const timer = activeRef.current.find((item) => item.taskId === id);
    const tracked =
      entries
        .filter((entry) => entry.taskId === id && entry.localDate === localDate)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0) +
      (timer ? elapsedSecondsForDate(timer, localDate, Date.now()) : 0);
    if (
      allotmentStopsTimer(
        parsed.goalKind,
        parsed.targetSeconds,
        tracked,
        Boolean(timer),
      )
    ) {
      if (!options.confirmStop)
        throw new Error(
          "Confirm stopping the timer before saving this allotment.",
        );
      // Pause against the old allotment before lowering it; never trim to the new target.
      await pauseTimer(id, false, true);
    }
    await ensureTaskTargets(
      [task],
      entries.filter((entry) => entry.taskId === id),
    );
    const next = {
      ...task,
      name: parsed.name,
      color: parsed.color,
      goalKind: parsed.goalKind,
      targetSeconds: options.useAsDefault
        ? parsed.targetSeconds
        : task.targetSeconds,
    };
    const target: TaskDailyTarget = {
      id: taskTargetId(id, localDate),
      userId,
      taskId: id,
      localDate,
      targetSeconds: parsed.targetSeconds,
    };
    const db = getLocalDatabase();
    if (db)
      await db.transaction("rw", [db.tasks, db.taskDailyTargets], async () => {
        await db.tasks.put(next);
        await db.taskDailyTargets.put(target);
      });
    targetsRef.current = [
      ...targetsRef.current.filter((item) => item.id !== target.id),
      target,
    ];
    setTaskDailyTargets(targetsRef.current);
    setTasks((current) =>
      current.map((item) => (item.id === id ? next : item)),
    );
    await persistMutation("task-target-upsert", {
      taskId: id,
      localDate,
      targetSeconds: target.targetSeconds,
    });
    await persistMutation("task-settings-update", {
      id,
      name: next.name,
      color: next.color,
      goalKind: next.goalKind,
      ...(options.useAsDefault ? { targetSeconds: next.targetSeconds } : {}),
    });
  }

  async function saveTaskListState(task: Task) {
    const state = taskListStateSchema.parse(task);
    await getLocalDatabase()?.tasks.put(task);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? task : item)),
    );
    await persistMutation("task-list-state", state);
  }

  async function archiveTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.archivedAt) return;
    await pauseTimer(id);
    await saveTaskListState(archiveSavedTask(task, new Date().toISOString()));
  }

  async function restoreTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task?.archivedAt) return;
    await saveTaskListState(restoreSavedTask(task));
  }

  async function removeTaskFromDailyList(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task || !task.onDailyList) return;
    await pauseTimer(id);
    await saveTaskListState(removeFromDailyList(task));
  }

  async function addTaskToDailyList(id: string, targetSeconds?: number) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.archivedAt || task.onDailyList) return;
    const localDate = todayKey(profile.timezone);
    if (targetSeconds !== undefined) {
      const target = taskDailyTargetSchema.parse({
        taskId: id,
        localDate,
        targetSeconds,
      });
      const row = { id: taskTargetId(id, localDate), userId, ...target };
      await getLocalDatabase()?.taskDailyTargets.put(row);
      targetsRef.current = [
        ...targetsRef.current.filter((item) => item.id !== row.id),
        row,
      ];
      setTaskDailyTargets(targetsRef.current);
      await persistMutation("task-target-upsert", { ...target });
    } else await ensureTaskTargets([task], [{ taskId: id, localDate }]);
    await saveTaskListState({ ...task, onDailyList: true });
  }

  async function reorderTasks(ids: string[]) {
    const selectedIds = dailyTasks(tasks).map((task) => task.id);
    if (
      ids.length !== selectedIds.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !selectedIds.includes(id))
    )
      return;
    const positions = new Map(ids.map((id, index) => [id, index]));
    const next = tasks
      .map((task) =>
        positions.has(task.id)
          ? { ...task, sortOrder: positions.get(task.id)! }
          : task,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    setTasks(next);
    await getLocalDatabase()?.tasks.bulkPut(next);
    for (const task of next.filter((item) => positions.has(item.id)))
      await persistMutation(
        "task-upsert",
        task as unknown as Record<string, unknown>,
      );
  }

  async function startTimer(taskId: string, limitOverride = false) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.archivedAt || !task.onDailyList) return;
    if (activeRef.current.some((timer) => timer.taskId === taskId)) return;
    await ensureTaskTargets(
      [task],
      [{ taskId, localDate: todayKey(profile.timezone) }],
    );
    if (activeRef.current.some((timer) => timer.taskId === taskId)) return;
    const startedAt = new Date().toISOString();
    const timer: ActiveTimer = {
      id: newId(),
      userId,
      taskId,
      startedAt,
      timezone: profile.timezone,
      accumulatedSeconds: 0,
      checkpointedAt: startedAt,
      checkpointSeconds: 0,
      limitOverride,
      mutationId: newId(),
    };
    activeRef.current = [...activeRef.current, timer];
    setActiveTimers((current) => [...current, timer]);
    await getLocalDatabase()?.activeTimers.put(timer);
    await persistMutation(
      "timer-start",
      timer as unknown as Record<string, unknown>,
    );
  }

  async function addEntry(input: EntryInput) {
    await ensureTaskTargets(tasks, [input]);
    const entry: TimeEntry = {
      id: newId(),
      userId,
      ...input,
      source: "manual",
      startedAt: null,
      endedAt: null,
      manuallyAdjusted: true,
      correctionOriginalTaskId: null,
      correctionOriginalLocalDate: null,
      correctionOriginalDurationSeconds: null,
      mutationId: newId(),
    };
    setEntries((current) => [...current, entry]);
    await getLocalDatabase()?.timeEntries.put(entry);
    await persistMutation(
      "entry-upsert",
      entry as unknown as Record<string, unknown>,
    );
  }

  async function updateEntry(id: string, input: EntryInput) {
    const existing = entries.find((entry) => entry.id === id);
    if (!existing) return;
    await ensureTaskTargets(tasks, [input]);
    const next = correctTimeEntry(existing, input);
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? next : entry)),
    );
    await getLocalDatabase()?.timeEntries.put(next);
    await persistMutation(
      "entry-upsert",
      next as unknown as Record<string, unknown>,
    );
  }

  async function revertEntryCorrection(id: string) {
    const existing = entries.find((entry) => entry.id === id);
    if (!existing) return;
    const next = revertTimeEntryCorrection(existing);
    if (!next) return;
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? next : entry)),
    );
    await getLocalDatabase()?.timeEntries.put(next);
    await persistMutation(
      "entry-upsert",
      next as unknown as Record<string, unknown>,
    );
    setNotice(
      "Correction reverted. The original timer time can count toward your streak again.",
    );
  }

  async function deleteEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    await getLocalDatabase()?.timeEntries.delete(id);
    await persistMutation("entry-delete", { id });
  }

  async function updateProfile(input: {
    displayName: string;
    timezone: string;
    theme: ThemePreference;
    onboardingCompleted?: boolean;
  }) {
    const next = {
      ...profile,
      ...input,
      onboardingCompleted:
        input.onboardingCompleted ?? profile.onboardingCompleted,
    };
    setProfile(next);
    await getLocalDatabase()?.profiles.put(next);
    await persistMutation(
      "profile-update",
      next as unknown as Record<string, unknown>,
    );
  }

  async function updateDailyGoal(goalSeconds: number) {
    const effectiveDate = todayKey(profile.timezone);
    const existing = dailyGoals.find(
      (goal) => goal.effectiveDate === effectiveDate,
    );
    const goal: DailyGoalChange = {
      id: existing?.id ?? newId(),
      userId,
      effectiveDate,
      goalSeconds,
    };
    setDailyGoals((current) => [
      ...current.filter((item) => item.effectiveDate !== effectiveDate),
      goal,
    ]);
    await getLocalDatabase()?.dailyGoals.put(goal);
    await persistMutation(
      "goal-upsert",
      goal as unknown as Record<string, unknown>,
    );
  }

  async function clearUserData() {
    await pauseAll();
    await clearLocalUser(userId);
    window.location.reload();
  }

  const today = todayKey(profile.timezone);
  const totals = useMemo(
    () => addActiveTimerTotals(aggregateEntries(entries), activeTimers, now),
    [activeTimers, entries, now],
  );
  const streakTotals = useMemo(
    () =>
      addActiveTimerTotals(aggregateStreakEntries(entries), activeTimers, now),
    [activeTimers, entries, now],
  );
  const streak = useMemo(
    () => calculateStreak(streakTotals, today, profile.accountStart),
    [profile.accountStart, streakTotals, today],
  );
  const value: AppContextValue = {
    userId,
    profile,
    dailyGoals,
    tasks,
    taskDailyTargets,
    activeTimers,
    entries,
    now,
    hydrated,
    syncState,
    notice,
    today,
    totals,
    streakTotals,
    streak,
    addTask,
    updateTask,
    updateTodayTask,
    archiveTask,
    restoreTask,
    addTaskToDailyList,
    removeTaskFromDailyList,
    reorderTasks,
    startTimer,
    pauseTimer,
    pauseAll,
    addEntry,
    updateEntry,
    revertEntryCorrection,
    deleteEntry,
    updateProfile,
    updateDailyGoal,
    clearUserData,
    dismissNotice: () => setNotice(null),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useTimeEight() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useTimeEight must be used within AppProvider");
  return value;
}
