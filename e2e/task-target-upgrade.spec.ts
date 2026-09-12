import { expect, test } from "@playwright/test";

test("upgrades existing task data and freezes historical targets before default edits", async ({
  page,
}) => {
  // Offline is outside AppProvider, allowing a legacy cache to be seeded first.
  await page.goto("/offline");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      // Dexie schema version 2 corresponds to native IndexedDB version 20.
      const request = indexedDB.open("timeeight", 20);
      request.onupgradeneeded = () => {
        const definitions: Record<string, string[]> = {
          profiles: [],
          dailyGoals: ["userId", "effectiveDate"],
          tasks: ["userId", "[userId+sortOrder]", "archivedAt"],
          activeTimers: ["userId", "[userId+taskId]"],
          timeEntries: ["userId", "[userId+localDate]", "taskId", "mutationId"],
          pendingMutations: ["userId", "createdAt"],
        };
        for (const [name, indexes] of Object.entries(definitions)) {
          const table = request.result.createObjectStore(name, {
            keyPath: "id",
          });
          for (const index of indexes) {
            table.createIndex(
              index,
              index.startsWith("[") ? index.slice(1, -1).split("+") : index,
            );
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        ["profiles", "tasks", "timeEntries"],
        "readwrite",
      );
      transaction.objectStore("profiles").put({
        id: "local-demo",
        displayName: "Ralph",
        timezone: "Asia/Manila",
        theme: "light",
        onboardingCompleted: true,
        accountStart: "2026-09-01",
      });
      transaction.objectStore("tasks").put({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: "local-demo",
        name: "Legacy reading",
        color: "#197c67",
        goalKind: "minimum",
        targetSeconds: 3600,
        sortOrder: 0,
        archivedAt: null,
        onDailyList: true,
      });
      transaction.objectStore("timeEntries").put({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        userId: "local-demo",
        taskId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        localDate: "2026-09-11",
        durationSeconds: 1200,
        source: "timer",
        startedAt: "2026-09-11T01:00:00Z",
        endedAt: "2026-09-11T01:20:00Z",
        manuallyAdjusted: false,
        correctionOriginalTaskId: null,
        correctionOriginalLocalDate: null,
        correctionOriginalDurationSeconds: null,
        mutationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Legacy reading" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Task list", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Task list", exact: true });
  await library
    .getByRole("button", { name: "Edit saved task Legacy reading" })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await editor.getByLabel("Default daily target in minutes").fill("120");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await library.getByRole("button", { name: "Close task list" }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit today’s allotment for Legacy reading",
    }),
  ).toHaveText("of 1h 0m");
  const historicalTarget = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("timeeight");
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<number>((resolve) => {
      const request = db
        .transaction("taskDailyTargets")
        .objectStore("taskDailyTargets")
        .get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:2026-09-11");
      request.onsuccess = () => {
        db.close();
        resolve(request.result.targetSeconds);
      };
    });
  });
  expect(historicalTarget).toBe(3600);
});
