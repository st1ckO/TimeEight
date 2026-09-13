import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { phraseForDate } from "../components/today/daily-phrase";

test("shows the fixed goal in onboarding and keeps Settings focused on preferences", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page.getByText("of 8h 0m", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText(/Daily ring goal/)).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await page.getByLabel("Display name").fill("Ralph updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page }).include(".settings-grid").analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.goto("/onboarding");
  await expect(page.getByText("8 hours", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
});

test("upgrades a custom goal without rewriting earlier daily goals", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
  const dates = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("timeeight");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const prior = new Date(`${date}T00:00:00Z`);
    prior.setUTCDate(prior.getUTCDate() - 1);
    const yesterday = prior.toISOString().slice(0, 10);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("dailyGoals", "readwrite");
      const store = tx.objectStore("dailyGoals");
      store.clear();
      store.put({
        id: "historical-goal",
        userId: "local-demo",
        effectiveDate: yesterday,
        goalSeconds: 14400,
      });
      store.put({
        id: "custom-today",
        userId: "local-demo",
        effectiveDate: date,
        goalSeconds: 3600,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { today: date, yesterday };
  });
  await page.reload();
  await expect(page.getByText("of 8h 0m", { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async ({ today, yesterday }) => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("timeeight");
          r.onsuccess = () => resolve(r.result);
        });
        const goals = await new Promise<
          { effectiveDate: string; goalSeconds: number }[]
        >((resolve) => {
          const r = db
            .transaction("dailyGoals")
            .objectStore("dailyGoals")
            .getAll();
          r.onsuccess = () => resolve(r.result);
        });
        db.close();
        return [
          goals.find((g) => g.effectiveDate === yesterday)?.goalSeconds,
          goals.find((g) => g.effectiveDate === today)?.goalSeconds,
        ];
      }, dates),
    )
    .toEqual([14400, 28800]);
});

test("keeps the rhythm phrase through reloads and updates on a new local day", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-13T04:00:00Z") });
  await page.goto("/today");
  await expect(page.getByText("Today’s rhythm", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: phraseForDate("2026-09-13"),
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: phraseForDate("2026-09-13"),
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-09-14T04:00:00Z"));
  await expect(
    page.getByRole("heading", {
      name: phraseForDate("2026-09-14"),
      exact: true,
    }),
  ).toBeVisible();
});
