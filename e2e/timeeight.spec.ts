import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("shares today's editor, preserves daily choices, and uses defaults tomorrow", async ({
  page,
}) => {
  const target = page.getByRole("button", {
    name: "Edit today’s allotment for Morning walk",
  });
  await target.click();
  let editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await editor.getByLabel("Hours", { exact: true }).fill("0");
  await editor.getByLabel("Minutes", { exact: true }).fill("20");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(target).toHaveText("of 20m");
  await page.getByRole("button", { name: "Actions for Morning walk" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await expect(editor.getByLabel("Minutes", { exact: true })).toHaveValue("20");
  await expect(editor.getByLabel("Use as task default too")).not.toBeChecked();
  await editor.getByRole("button", { name: "Reset to default" }).click();
  await expect(editor.getByLabel("Hours", { exact: true })).toHaveValue("1");
  await editor.getByLabel("Hours", { exact: true }).fill("0");
  await editor.getByLabel("Minutes", { exact: true }).fill("20");
  await editor.getByLabel("Use as task default too").check();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Task list", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Task list", exact: true });
  await library
    .getByRole("button", { name: "Edit saved task Morning walk" })
    .click();
  editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await expect(
    editor.getByLabel("Default daily target in minutes"),
  ).toHaveValue("20");
  await editor.getByLabel("Default daily target in minutes").fill("45");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await library.getByRole("button", { name: "Close task list" }).click();
  await expect(target).toHaveText("of 20m");
  await page.reload();
  await expect(target).toHaveText("of 20m");
  await page.clock.install();
  await page.clock.setFixedTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await expect(target).toHaveText("of 45m");
});

test("warns before lowering a running limit and retains tracked time", async ({
  page,
}) => {
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const entry = page.getByRole("dialog");
  await entry.getByRole("combobox").selectOption({ label: "Watch list" });
  await entry.getByLabel("Hours", { exact: true }).fill("0");
  await entry.getByLabel("Minutes", { exact: true }).fill("10");
  await entry.getByRole("button", { name: "Add time", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page.getByRole("button", { name: "Start Watch list" }).click();
  await page.waitForTimeout(1100);
  await page
    .getByRole("button", { name: "Edit today’s allotment for Watch list" })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await editor.getByLabel("Hours", { exact: true }).fill("0");
  await editor.getByLabel("Minutes", { exact: true }).fill("5");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor.getByRole("alert")).toContainText("Confirm stopping");
  await editor
    .getByRole("checkbox", { name: /Stop the running timer/ })
    .check();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Pause Watch list" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Continue Watch list" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit today’s allotment for Watch list" })
    .click();
  await editor.getByLabel("Minutes", { exact: true }).fill("30");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Start Watch list" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause Watch list" }),
  ).toBeHidden();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  const history = page
    .locator(".history-entry")
    .filter({ has: page.getByRole("heading", { name: "Watch list" }) });
  await expect(history).toHaveCount(2);
  await expect(history.filter({ hasText: "Manual correction" })).toContainText(
    "10m",
  );
  await expect(history.filter({ hasText: "Timer" })).toContainText(
    "Allotment: 30m",
  );
});

test("can adjust a reused task and fits today's editor at 320px in both themes", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Actions for Morning walk" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove task" })
    .click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "From task list" }).click();
  await picker
    .getByRole("button", { name: "Adjust allotment for Morning walk" })
    .click();
  await picker
    .getByLabel("Today’s allotment in minutes", { exact: true })
    .fill("20");
  await picker
    .getByRole("button", { name: "Add Morning walk to daily list" })
    .click();
  const target = page.getByRole("button", {
    name: "Edit today’s allotment for Morning walk",
  });
  await expect(target).toHaveText("of 20m");
  await page.setViewportSize({ width: 320, height: 800 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await target.click();
    const editor = page.getByRole("dialog", { name: "Edit task", exact: true });
    await expect(editor.getByLabel("Minutes", { exact: true })).toHaveValue(
      "20",
    );
    const checkboxCenterOffset = await editor
      .locator(".allotment-check")
      .first()
      .evaluate((label) => {
        const checkbox = label.querySelector("input")!.getBoundingClientRect();
        const text = label.querySelector("span")!.getBoundingClientRect();
        return Math.abs(
          checkbox.y + checkbox.height / 2 - (text.y + text.height / 2),
        );
      });
    expect(checkboxCenterOffset).toBeLessThanOrEqual(1);
    expect(
      await editor.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".task-dialog").analyze())
        .violations,
    ).toEqual([]);
    await testInfo.attach(`today-editor-320-${theme}`, {
      body: await editor.screenshot(),
      contentType: "image/png",
    });
    await editor.getByRole("button", { name: "Close", exact: true }).click();
  }
});

test("fits the saved list and picker at 320px in both themes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.getByRole("button", { name: "Task list", exact: true }).click();
    const library = page.getByRole("dialog", {
      name: "Task list",
      exact: true,
    });
    expect(
      await library.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".task-dialog").analyze())
        .violations,
    ).toEqual([]);
    await testInfo.attach(`saved-list-320-${theme}`, {
      body: await library.screenshot(),
      contentType: "image/png",
    });
    await library.getByRole("button", { name: "Close task list" }).click();
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("button", { name: "From task list" }).click();
    expect(
      await picker.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".task-dialog").analyze())
        .violations,
    ).toEqual([]);
    await testInfo.attach(`task-picker-320-${theme}`, {
      body: await picker.screenshot(),
      contentType: "image/png",
    });
    await picker.getByRole("button", { name: "Close", exact: true }).click();
  }
});

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
  await expect(
    page.getByRole("button", { name: /\d+-day streak/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /weekly streak saver/i }),
  ).toBeVisible();
});

test("does not use manual calendar time for streak progress", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Calendar" }).first().click();
  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByLabel("Hours").fill("3");
  await page.getByLabel("Minutes").fill("0");
  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByRole("link", { name: "Today" }).first().click();

  await expect(
    page.getByRole("button", {
      name: /0-day streak, 3h 0m left today/i,
    }),
  ).toBeVisible();
});

test("reveals the streak rules from the compact badge", async ({
  page,
}, testInfo) => {
  const streakBadge = page.getByRole("button", { name: /\d+-day streak/i });

  if (testInfo.project.name === "chromium") {
    await streakBadge.hover();
  } else {
    await streakBadge.focus();
  }

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(
    "Manual and corrected entries do not count toward streaks.",
  );
});

test("reveals weekly saver rules from the compact shield", async ({
  page,
}, testInfo) => {
  const saverBadge = page.getByRole("button", {
    name: /weekly streak saver/i,
  });

  if (testInfo.project.name === "chromium") {
    await saverBadge.hover();
  } else {
    await saverBadge.focus();
  }

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(
    "It automatically protects the first missed day each Monday–Sunday.",
  );
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

test("reverts a timer correction to restore streak eligibility", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start Morning walk" }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause Morning walk" }).click();
  await page.getByRole("link", { name: "Calendar" }).first().click();

  await page
    .getByRole("button", { name: "Edit entry for Morning walk" })
    .click();
  await page.getByLabel("Hours").fill("1");
  await page.getByLabel("Minutes").fill("0");
  await page.getByRole("button", { name: "Save correction" }).click();

  await expect(page.getByText("Timer · corrected")).toBeVisible();
  await page
    .getByRole("button", { name: "Revert correction for Morning walk" })
    .click();

  await expect(page.getByText("Timer · corrected")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Revert correction for Morning walk" }),
  ).toBeHidden();
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

test("adds a task with a compact keyboard intention control and expanded colors", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Task name")).toBeFocused();
  const description = await dialog.locator(".task-description").boundingBox();
  const heading = await dialog.locator(".dialog-heading").boundingBox();
  const form = await dialog.locator("form").boundingBox();
  const intention = await dialog.locator(".task-intention").boundingBox();
  expect(description!.y - (heading!.y + heading!.height)).toBeCloseTo(10, 0);
  const body = await dialog.locator(".task-dialog-body").boundingBox();
  expect(body!.y - (description!.y + description!.height)).toBeCloseTo(24, 0);
  expect(intention!.height).toBeLessThanOrEqual(52);
  const submitButton = dialog.getByRole("button", {
    name: "Add task",
    exact: true,
  });
  await expect(submitButton).toHaveCSS("font-size", "16px");
  const submitBounds = await submitButton.boundingBox();
  expect(submitBounds!.width).toBeCloseTo(form!.width, 0);
  await dialog.getByRole("radio", { name: "Build time" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Limit time" })).toBeChecked();
  await expect(
    dialog.getByRole("button", { name: /^Use .* color$/ }),
  ).toHaveCount(12);
  await dialog.getByRole("button", { name: "Use cyan color" }).click();
  await expect(
    dialog.getByRole("button", { name: "Use cyan color" }),
  ).toHaveAttribute("aria-pressed", "true");
  const report = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  expect(report.violations).toEqual([]);
  await testInfo.attach("add-task-dialog", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await dialog.getByLabel("Task name").fill("Evening reading");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Evening reading" }),
  ).toBeVisible();
});

test("removes and reuses a daily task while carrying choices into tomorrow", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start Morning walk" }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Actions for Morning walk" }).click();
  await expect(
    page.getByRole("button", { name: "Archive", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  let confirmation = page.getByRole("dialog");
  await expect(
    confirmation.getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("button", { name: "Pause Morning walk" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Actions for Morning walk" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  confirmation = page.getByRole("dialog");
  await confirmation.getByRole("button", { name: "Remove task" }).click();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Pause all" })).toBeHidden();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await expect(page).toHaveURL(/\/today$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Portfolio project" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeHidden();
  // Choices are persistent, not reset by the local day boundary.
  await page.clock.install();
  await page.clock.setFixedTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Portfolio project" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "From task list" }).click();
  await expect(
    picker.getByRole("button", {
      name: "Portfolio project is already on your daily list",
    }),
  ).toBeDisabled();
  await picker
    .getByRole("button", { name: "Add Morning walk to daily list" })
    .click();
  await expect(picker).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
  const taskCount = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("timeeight");
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<number>((resolve) => {
      const request = db.transaction("tasks").objectStore("tasks").count();
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
    });
  });
  expect(taskCount).toBe(3);
});

test("archives with confirmation and restores saved tasks without losing history", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Start Morning walk" }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Task list", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Task list", exact: true });
  await library
    .getByRole("button", { name: "Archive Morning walk", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Archive Morning walk?",
    exact: true,
  });
  await expect(confirmation).toContainText("elapsed time will be saved");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(
    library.getByRole("button", { name: "Archive Morning walk" }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Archive Morning walk" }).click();
  await page
    .getByRole("dialog", { name: "Archive Morning walk?", exact: true })
    .getByRole("button", { name: "Archive task" })
    .click();
  await expect(
    library.getByRole("button", { name: "Archive Morning walk" }),
  ).toBeHidden();
  await library.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(
    library.getByRole("button", { name: "Restore Morning walk" }),
  ).toBeVisible();
  const report = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  expect(report.violations).toEqual([]);
  await testInfo.attach("archived-task-list", {
    body: await library.screenshot(),
    contentType: "image/png",
  });
  await library.getByRole("button", { name: "Restore Morning walk" }).click();
  await library.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    library.getByRole("button", { name: "Archive Morning walk" }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Close task list" }).click();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Pause all" })).toBeHidden();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Morning walk" }),
  ).toBeVisible();
});
