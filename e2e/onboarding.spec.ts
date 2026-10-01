import { expect, test } from "@playwright/test";

test("keeps the three example timers selected during onboarding", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page.getByText("Today’s rhythm", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeEnabled();

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("timeeight");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        ["profiles", "tasks", "taskDailyTargets"],
        "readwrite",
      );
      transaction.objectStore("profiles").put({
        id: "local-demo",
        displayName: "Ralph",
        timezone: "Asia/Manila",
        theme: "system",
        onboardingCompleted: false,
        accountStart: "2026-09-01",
      });
      transaction.objectStore("tasks").clear();
      transaction.objectStore("taskDailyTargets").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });

  await page.goto("/onboarding");
  const keepExamples = page.getByRole("checkbox", {
    name: /keep three editable example timers/i,
  });
  await expect(keepExamples).toBeChecked();
  await page.getByRole("button", { name: "Open my day" }).click();

  await expect(page).toHaveURL(/\/today$/);
  for (const name of ["Focus time", "Learning", "Screen time"]) {
    await expect(
      page.getByRole("button", { name: `Start ${name}`, exact: true }),
    ).toBeVisible();
  }
});
