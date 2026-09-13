import { expect, test } from "@playwright/test";

test("caps manual and corrected limit time in daily progress after reload", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Watch list", exact: true }).click();
  await dialog.getByLabel("Hours", { exact: true }).fill("2");
  await dialog.getByLabel("Minutes", { exact: true }).fill("0");
  await dialog.getByRole("button", { name: "Add time", exact: true }).click();
  await expect(page.locator(".day-total strong")).toHaveText("2h 0m");
  await page
    .getByRole("button", { name: "Entry actions for Watch list" })
    .click();
  await page.getByRole("menuitem", { name: "Edit entry", exact: true }).click();
  await dialog.getByLabel("Hours", { exact: true }).fill("4");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(page.locator(".day-total strong")).toHaveText("4h 0m");
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await expect(page.locator(".daily-card .ring-copy strong")).toHaveText(
    "1h 0m",
  );
  await page.reload();
  await expect(page.locator(".daily-card .ring-copy strong")).toHaveText(
    "1h 0m",
  );
  await expect(
    page.getByRole("img", { name: "13% of daily goal" }),
  ).toBeVisible();
});
