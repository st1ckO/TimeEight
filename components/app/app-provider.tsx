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
  ThemePreference,
  TimeEntry,
} from "@/lib/domain/types";
import {
  aggregateEntries,
  elapsedSeconds,
  localDateAt,
  splitDurationAcrossLocalDates,
} from "@/lib/domain/time";
import { calculateStreak } from "@/lib/domain/streak";
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
  activeTimers: ActiveTimer[];
  entries: TimeEntry[];
  now: number;
  hydrated: boolean;
  syncState: "local" | "synced" | "pending" | "offline" | "error";
  notice: string | null;
  today: string;
  totals: Map<string, number>;
  streak: ReturnType<typeof calculateStreak>;
  addTask(input: AddTaskInput): Promise<void>;
  updateTask(id: string, input: AddTaskInput): Promise<void>;
  archiveTask(id: string): Promise<void>;
  reorderTasks(ids: string[]): Promise<void>;
  startTimer(taskId: string, limitOverride?: boolean): Promise<void>;
  pauseTimer(taskId: string, recovered?: boolean): Promise<void>;
  pauseAll(): Promise<void>;
  addEntry(input: EntryInput): Promise<void>;
  updateEntry(id: string, input: EntryInput): Promise<void>;
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
    },
  ];
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
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
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
      let storedGoals = await db.dailyGoals
        .where("userId")
        .equals(userId)
        .toArray();
      let storedTasks = await db.tasks.where("userId").equals(userId).toArray();
      const storedTimers = await db.activeTimers
        .where("userId")
        .equals(userId)
        .toArray();
      let storedEntries = await db.timeEntries
        .where("userId")
        .equals(userId)
        .toArray();
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

      let remoteAfter = remoteBefore;
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
        storedEntries = remoteAfter.entries;
      }
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

      await db.profiles.put(storedProfile);
      await db.dailyGoals.where("userId").equals(userId).delete();
      await db.tasks.where("userId").equals(userId).delete();
      await db.activeTimers.where("userId").equals(userId).delete();
      await db.timeEntries.where("userId").equals(userId).delete();
      if (storedGoals.length > 0) await db.dailyGoals.bulkPut(storedGoals);
      if (storedTasks.length > 0) await db.tasks.bulkPut(storedTasks);
      if (remoteAfter?.activeTimers.length)
        await db.activeTimers.bulkPut(remoteAfter.activeTimers);
      if (storedEntries.length > 0) await db.timeEntries.bulkPut(storedEntries);
      if (cancelled) return;
      setProfile(storedProfile);
      setDailyGoals(storedGoals);
      setTasks(storedTasks.sort((a, b) => a.sortOrder - b.sortOrder));
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
    async (taskId: string, recovered = false) => {
      const timer = activeRef.current.find((item) => item.taskId === taskId);
      if (!timer) return;
      const endedAt = new Date().toISOString();
      const task = tasks.find((item) => item.id === taskId);
      let duration = elapsedSeconds(timer, Date.parse(endedAt));
      const date = todayKey(timer.timezone);
      const previousToday = entries
        .filter((entry) => entry.taskId === taskId && entry.localDate === date)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);
      if (task?.goalKind === "limit" && !timer.limitOverride)
        duration = Math.min(
          duration,
          Math.max(0, task.targetSeconds - previousToday),
        );
      const slices = splitDurationAcrossLocalDates(
        timer.startedAt,
        new Date(Date.parse(timer.startedAt) + duration * 1000).toISOString(),
        timer.timezone,
      );
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
        mutationId: newId(),
      }));
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
    const task: Task = {
      id: newId(),
      userId,
      name: input.name.trim(),
      color: input.color ?? palette[tasks.length % palette.length]!,
      goalKind: input.goalKind,
      targetSeconds: input.targetSeconds,
      sortOrder: tasks.filter((item) => !item.archivedAt).length,
      archivedAt: null,
    };
    setTasks((current) => [...current, task]);
    await getLocalDatabase()?.tasks.put(task);
    await persistMutation(
      "task-upsert",
      task as unknown as Record<string, unknown>,
    );
  }

  async function updateTask(id: string, input: AddTaskInput) {
    const existing = tasks.find((task) => task.id === id);
    if (!existing) return;
    const next = {
      ...existing,
      ...input,
      name: input.name.trim(),
      color: input.color ?? existing.color,
    };
    setTasks((current) =>
      current.map((task) => (task.id === id ? next : task)),
    );
    await getLocalDatabase()?.tasks.put(next);
    await persistMutation(
      "task-upsert",
      next as unknown as Record<string, unknown>,
    );
  }

  async function archiveTask(id: string) {
    if (activeRef.current.some((timer) => timer.taskId === id))
      await pauseTimer(id);
    const archivedAt = new Date().toISOString();
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, archivedAt } : task)),
    );
    await getLocalDatabase()?.tasks.update(id, { archivedAt });
    await persistMutation("task-archive", { id, archivedAt });
  }

  async function reorderTasks(ids: string[]) {
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
    setActiveTimers((current) => [...current, timer]);
    await getLocalDatabase()?.activeTimers.put(timer);
    await persistMutation(
      "timer-start",
      timer as unknown as Record<string, unknown>,
    );
  }

  async function addEntry(input: EntryInput) {
    const entry: TimeEntry = {
      id: newId(),
      userId,
      ...input,
      source: "manual",
      startedAt: null,
      endedAt: null,
      manuallyAdjusted: true,
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
    const next: TimeEntry = { ...existing, ...input, manuallyAdjusted: true };
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? next : entry)),
    );
    await getLocalDatabase()?.timeEntries.put(next);
    await persistMutation(
      "entry-upsert",
      next as unknown as Record<string, unknown>,
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
  const totals = useMemo(() => {
    const all = aggregateEntries(entries);
    for (const timer of activeTimers) {
      const slices = splitDurationAcrossLocalDates(
        timer.startedAt,
        new Date(now).toISOString(),
        timer.timezone,
      );
      for (const slice of slices) {
        all.set(
          slice.localDate,
          (all.get(slice.localDate) ?? 0) + slice.durationSeconds,
        );
      }
    }
    return all;
  }, [activeTimers, entries, now]);
  const streak = useMemo(
    () => calculateStreak(totals, today, profile.accountStart),
    [profile.accountStart, today, totals],
  );
  const value: AppContextValue = {
    userId,
    profile,
    dailyGoals,
    tasks,
    activeTimers,
    entries,
    now,
    hydrated,
    syncState,
    notice,
    today,
    totals,
    streak,
    addTask,
    updateTask,
    archiveTask,
    reorderTasks,
    startTimer,
    pauseTimer,
    pauseAll,
    addEntry,
    updateEntry,
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
