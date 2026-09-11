"use client";

import { useEffect, useRef } from "react";
import { useTimeEight } from "./app-provider";

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(
    input: Record<string, unknown>,
  ): Promise<{ content: { type: "text"; text: string }[] }>;
}

declare global {
  interface Navigator {
    modelContext?: {
      registerTool(tool: WebMcpTool): void;
      unregisterTool(name: string): void;
    };
  }
}

const result = (text: string) =>
  Promise.resolve({ content: [{ type: "text" as const, text }] });

export function WebMcpTools() {
  const app = useTimeEight();
  const appRef = useRef(app);
  useEffect(() => {
    appRef.current = app;
  }, [app]);

  useEffect(() => {
    const context = navigator.modelContext;
    if (!context) return;
    const tools: WebMcpTool[] = [
      {
        name: "timeeight_add_task",
        description:
          "Add a reusable build-time or limit-time task to the signed-in user's TimeEight day.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            goal_kind: { type: "string", enum: ["minimum", "limit"] },
            target_minutes: { type: "number", minimum: 1, maximum: 1440 },
            color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          },
          required: ["name", "goal_kind", "target_minutes"],
          additionalProperties: false,
        },
        async execute(input) {
          await appRef.current.addTask({
            name: String(input.name),
            goalKind: input.goal_kind as "minimum" | "limit",
            targetSeconds: Math.round(Number(input.target_minutes) * 60),
            color: input.color ? String(input.color) : undefined,
          });
          return result(`Added ${String(input.name)} to TimeEight.`);
        },
      },
      {
        name: "timeeight_add_time",
        description:
          "Add a duration-based manual TimeEight entry for an existing task and local date.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: { type: "string" },
            local_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            duration_minutes: { type: "number", minimum: 1, maximum: 1440 },
          },
          required: ["task_id", "local_date", "duration_minutes"],
          additionalProperties: false,
        },
        async execute(input) {
          const taskId = String(input.task_id);
          if (!appRef.current.tasks.some((task) => task.id === taskId))
            return result("The task was not found.");
          await appRef.current.addEntry({
            taskId,
            localDate: String(input.local_date),
            durationSeconds: Math.round(Number(input.duration_minutes) * 60),
          });
          return result("Added the tracked duration to TimeEight.");
        },
      },
      {
        name: "timeeight_pause_all",
        description: "Pause every currently active TimeEight timer.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          await appRef.current.pauseAll();
          return result("Paused all TimeEight timers.");
        },
      },
    ];
    for (const tool of tools) context.registerTool(tool);
    return () => {
      for (const tool of tools) context.unregisterTool(tool.name);
    };
  }, [app.userId]);

  return null;
}
