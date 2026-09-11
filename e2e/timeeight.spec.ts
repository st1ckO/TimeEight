import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      pageErrors.push(message.text());
  });
  await page.goto("/today");
  await page.waitForTimeout(300);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
  await expect(page.getByText(/^\d+-day streak$/)).toBeVisible();
});

test("tracks concurrent tasks and writes duration history", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start Morning walk" }).click();
  await page.getByRole("button", { name: "Start Portfolio project" }).click();
  await expect(page.getByText("2 timers active")).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause all" }).click();
  await expect(page.getByText("2 timers active")).toBeHidden();

  await page.getByRole("link", { name: "Calendar" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portfolio project" }),
  ).toBeVisible();
});

test("offers a button alternative to drag reordering", async ({ page }) => {
  await page.getByRole("button", { name: "Actions for Morning walk" }).click();
  await page.getByRole("button", { name: "Move down" }).click();
  const names = await page.locator(".task-card h3").allTextContents();
  expect(names.slice(0, 2)).toEqual(["Portfolio project", "Morning walk"]);
});

test("has no serious automated accessibility violations", async ({ page }) => {
  const report = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    report.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
