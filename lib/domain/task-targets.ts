import type { Task, TaskDailyTarget } from "./types";

export function taskTargetId(taskId: string, localDate: string) {
  return `${taskId}:${localDate}`;
}

export function taskTargetForDate(
  task: Task,
  targets: TaskDailyTarget[],
  localDate: string,
) {
  return (
    targets.find(
      (target) => target.taskId === task.id && target.localDate === localDate,
    )?.targetSeconds ?? task.targetSeconds
  );
}

export function missingTaskTargets(
  tasks: Task[],
  targets: TaskDailyTarget[],
  choices: { taskId: string; localDate: string }[],
): TaskDailyTarget[] {
  const seen = new Set(
    targets.map((target) => taskTargetId(target.taskId, target.localDate)),
  );
  return choices.flatMap(({ taskId, localDate }) => {
    const task = tasks.find((item) => item.id === taskId);
    const id = taskTargetId(taskId, localDate);
    if (!task || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        userId: task.userId,
        taskId,
        localDate,
        targetSeconds: task.targetSeconds,
      },
    ];
  });
}

export function allotmentStopsTimer(
  goalKind: Task["goalKind"],
  targetSeconds: number,
  trackedSeconds: number,
  running: boolean,
) {
  return running && goalKind === "limit" && trackedSeconds >= targetSeconds;
}
