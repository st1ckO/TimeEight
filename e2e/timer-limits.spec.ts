import { expect, test } from "@playwright/test";

test("enforces a missed limit on Insights after midnight", async ({ page }) => {
  await page.goto("/today");
  await expect(
    page.getByRole("button", { name: "Start Watch list", exact: true }),
  ).toBeVisible();
  await page.clock.install({ time: new Date("2026-09-13T14:30:00Z") });
  await page.clock.runFor(1000);
  await page
    .getByRole("button", { name: "Start Watch list", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Insights", exact: true })
    .first()
    .click();
  await page.clock.setFixedTime(new Date("2026-09-13T17:30:00Z"));
  await expect(page.locator(".active-dock")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(page.locator(".day-total strong")).toHaveText("0s");
  await page
    .getByRole("link", { name: "Insights", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".record-card")
      .filter({ hasText: "Longest session" })
      .locator("strong"),
  ).toHaveText("1h 0m");
});

test("expires yesterday's continuation and pauses at today's limit on Calendar", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(
    page.getByRole("button", { name: "Start Watch list", exact: true }),
  ).toBeVisible();
  await page.clock.install({ time: new Date("2026-09-13T15:00:00Z") });
  await page.clock.runFor(1000);
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Watch list", exact: true }).click();
  await dialog.getByLabel("Hours", { exact: true }).fill("1");
  await dialog.getByLabel("Minutes", { exact: true }).fill("0");
  await dialog.getByRole("button", { name: "Add time", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Continue Watch list", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await page.clock.setFixedTime(new Date("2026-09-13T16:30:00Z"));
  await expect(
    page.getByRole("button", { name: "Pause Watch list", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await page.clock.setFixedTime(new Date("2026-09-13T18:00:00Z"));
  await expect(page.locator(".day-total strong")).toHaveText("1h 0m");
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Continue Watch list", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".daily-card .ring-copy strong")).toHaveText(
    "1h 0m",
  );
});
