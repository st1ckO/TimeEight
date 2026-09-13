import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("saves settings only when preferences change", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  const name = page.getByLabel("Display name", { exact: true });
  const originalName = await name.inputValue();
  const timezone = page.getByRole("button", { name: "Timezone", exact: true });
  const originalTimezone = await timezone.innerText();
  await expect(save).toBeDisabled();
  await name.fill(originalName + " edited");
  await expect(save).toBeEnabled();
  await name.fill(originalName);
  await expect(save).toBeDisabled();
  const triggerBounds = await timezone.boundingBox();
  await timezone.click();
  const menuBounds = await page.locator(".entry-task-menu").boundingBox();
  expect(Math.abs(menuBounds!.x - triggerBounds!.x)).toBeLessThan(2);
  expect(Math.abs(menuBounds!.width - triggerBounds!.width)).toBeLessThan(2);
  expect(menuBounds!.height).toBeLessThanOrEqual(420);
  await page.screenshot({ path: testInfo.outputPath("timezone-picker.png") });
  expect(await page.getByRole("option").count()).toBeGreaterThan(30);
  expect(await page.getByRole("option").count()).toBeLessThan(45);
  await expect(
    page.getByRole("group", { name: "Asia", exact: true }),
  ).toBeVisible();
  const search = page.getByRole("combobox", { name: "Search timezones" });
  await search.fill("Chatham");
  await expect(page.getByRole("option", { name: /Chatham/ })).toBeVisible();
  await search.fill("not-a-timezone");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(
    page.getByText("No timezones found.", { exact: false }),
  ).toBeVisible();
  await search.fill("05:45");
  await expect(
    page.getByRole("option", { name: /Kat(h)?mandu/ }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(timezone).toContainText("UTC+05:45");
  await expect(save).toBeEnabled();
  await page
    .getByRole("button", { name: "Use device timezone", exact: true })
    .click();
  const deviceZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  await expect(timezone).toContainText(deviceZone.replaceAll("_", " "));
  await expect(
    page.getByRole("button", { name: "Use device timezone", exact: true }),
  ).toBeDisabled();
  await timezone.click();
  await page
    .getByRole("option", { name: originalTimezone, exact: true })
    .click();
  await expect(save).toBeDisabled();
  const selectedTheme = page.getByRole("radio", { checked: true });
  const originalTheme = await selectedTheme.inputValue();
  await selectedTheme.focus();
  await page.keyboard.press("ArrowRight");
  await expect(save).toBeEnabled();
  await page
    .locator(`.settings-theme-choice input[value="${originalTheme}"]`)
    .focus();
  await page.keyboard.press("Space");
  await expect(save).toBeDisabled();
  await name.fill(originalName + " edited");
  await save.click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Changes saved.");
  await name.fill(originalName + " another edit");
  await expect(save).toBeEnabled();
  await name.fill(originalName + " edited");
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(name).toHaveValue(originalName + " edited");
  await expect(save).toBeDisabled();
  for (const width of [1500, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.waitForTimeout(400);
      const scan = await new AxeBuilder({ page })
        .include(".settings-form")
        .analyze();
      expect(scan.violations).toEqual([]);
      expect(
        await page
          .locator(".settings-form")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await timezone.click();
      const pickerScan = await new AxeBuilder({ page })
        .include(".timezone-search-menu")
        .analyze();
      expect(pickerScan.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`settings-${width}-${theme}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(timezone).toBeFocused();
    }
  }
});

test("scrolls long history without growing the calendar", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  const calendar = page.locator(".calendar-card");
  const initialHeight = (await calendar.boundingBox())!.height;
  for (let index = 0; index < 10; index++) {
    await page.getByRole("button", { name: "Add time", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Add tracked time",
      exact: true,
    });
    await dialog.getByRole("button", { name: "Add time", exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  expect((await calendar.boundingBox())!.height).toBeCloseTo(initialHeight, 0);
  expect((await page.locator(".day-detail").boundingBox())!.height).toBeCloseTo(
    initialHeight,
    0,
  );
  for (const width of [1500, 320]) {
    await page.setViewportSize({ width, height: 950 });
    const history = page.getByRole("region", {
      name: "Tracked entries",
      exact: true,
    });
    expect(
      await history.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    if (width === 320)
      expect((await page.locator(".day-detail").boundingBox())!.height).toBe(
        560,
      );
    await history.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() => history.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await history
      .getByRole("button", { name: /Entry actions/ })
      .last()
      .focus();
    await expect(
      history.getByRole("button", { name: /Entry actions/ }).last(),
    ).toBeFocused();
    const scan = await new AxeBuilder({ page })
      .include(".day-detail")
      .analyze();
    expect(scan.violations).toEqual([]);
  }
});

test("keeps calendar entry controls balanced in both themes", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const longName =
    "Super Long Task Name That Would Surely Exceed The UI Boundaries";
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog.getByLabel("Task name").fill(longName);
  await taskDialog
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  for (const width of [1500, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const add = page.getByRole("button", { name: "Add time", exact: true });
      const summary = page.locator(".day-summary");
      const dateBounds = await summary.locator("h2").boundingBox();
      const totalBounds = await summary.locator(".day-total").boundingBox();
      expect(totalBounds!.x).toBeGreaterThan(dateBounds!.x + dateBounds!.width);
      const summaryBounds = await summary.boundingBox();
      const toolbarBounds = await page
        .locator(".day-history-toolbar")
        .boundingBox();
      expect(toolbarBounds!.y).toBeGreaterThanOrEqual(
        summaryBounds!.y + summaryBounds!.height,
      );
      const sort = page.getByRole("combobox", {
        name: /History order: Latest first/,
      });
      const sortBounds = await sort.boundingBox();
      const addBounds = await add.boundingBox();
      expect(sortBounds!.x).toBeCloseTo(toolbarBounds!.x, 0);
      expect(addBounds!.x + addBounds!.width).toBeCloseTo(
        toolbarBounds!.x + toolbarBounds!.width,
        0,
      );
      await sort.click();
      const sortScan = await new AxeBuilder({ page })
        .include(".history-sort-menu")
        .analyze();
      expect(sortScan.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`calendar-sort-${width}-${theme}.png`),
      });
      await page
        .getByRole("option", { name: "Oldest first", exact: true })
        .click();
      await expect(
        page.getByRole("combobox", { name: /History order: Oldest first/ }),
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: /History order: Oldest first/ })
        .click();
      await page
        .getByRole("option", { name: "Latest first", exact: true })
        .click();
      expect(
        await page
          .locator(".day-detail")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`calendar-summary-${width}-${theme}.png`),
      });
      expect(
        await add.evaluate((element) => getComputedStyle(element).whiteSpace),
      ).toBe("nowrap");
      expect(
        await add.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(14);
      await add.click();
      const dialog = page.getByRole("dialog", {
        name: "Add tracked time",
        exact: true,
      });
      expect(
        await dialog
          .getByRole("button", { name: "Add time", exact: true })
          .evaluate((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          ),
      ).toBeGreaterThanOrEqual(14);
      const heading = await dialog.locator(".dialog-heading").boundingBox();
      const description = await dialog
        .locator(".entry-description")
        .boundingBox();
      expect(description!.y - heading!.y - heading!.height).toBeCloseTo(12, 0);
      const hoursLabel = dialog.locator(".duration-fields label").first();
      await expect(hoursLabel).toContainText("Duration (hours)");
      expect(
        await hoursLabel.evaluate(
          (element) => getComputedStyle(element).whiteSpace,
        ),
      ).toBe("nowrap");
      const select = page.locator(".entry-task-trigger");
      await select.click();
      const menu = page.getByRole("listbox");
      const field = await select.boundingBox();
      const menuBounds = await menu.boundingBox();
      const longOption = page.getByRole("option", {
        name: longName,
        exact: true,
      });
      expect(
        await longOption.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`calendar-menu-${width}-${theme}.png`),
      });
      expect(menuBounds!.x).toBeCloseTo(field!.x, 0);
      expect(menuBounds!.width).toBeCloseTo(field!.width, 0);
      const menuScan = await new AxeBuilder({ page })
        .include(".entry-task-menu")
        .analyze();
      expect(menuScan.violations).toEqual([]);
      await page.keyboard.press("End");
      await page.keyboard.press("Home");
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(select).toBeFocused();
      await select.click();
      await page
        .getByRole("option", { name: "Watch list", exact: true })
        .click();
      await expect(select).toContainText("Watch list");
      await expect(dialog).toContainText(
        "Added or corrected time counts toward daily totals, but not the three-hour streak.",
      );
      await dialog.getByLabel("Hours", { exact: true }).fill("0");
      await dialog.getByLabel("Minutes", { exact: true }).fill("15");
      const scan = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();
      expect(scan.violations).toEqual([]);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`calendar-entry-${width}-${theme}.png`),
      });
      await dialog
        .getByRole("button", { name: "Add time", exact: true })
        .click();
      await expect(dialog).toBeHidden();
    }
  }
});
test("keeps the active card fixed and scrolls consistent timer rows", async ({
  page,
}, testInfo) => {
  const card = page.locator(".active-timers-card");
  expect((await card.boundingBox())!.height).toBe(260);
  const longName =
    "Super Long Task Name That Would Surely Exceed The UI Boundaries";
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task name").fill(longName);
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  for (const name of [
    "Morning walk",
    "Portfolio project",
    "Watch list",
    longName,
  ]) {
    await page
      .getByRole("button", { name: `Start ${name}`, exact: true })
      .click();
    expect((await card.boundingBox())!.height).toBe(260);
  }
  for (const width of [1500, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await expect(card.getByText("Right now", { exact: true })).toHaveCount(0);
      for (const button of await card.locator(".active-timer-pause").all()) {
        const center = await button.evaluate((element) => {
          const button = element.getBoundingClientRect();
          const icon = element.querySelector("svg")!.getBoundingClientRect();
          return {
            x: Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2),
            y: Math.abs(
              button.y + button.height / 2 - icon.y - icon.height / 2,
            ),
            width: button.width,
            height: button.height,
          };
        });
        expect(center.x).toBeLessThan(1);
        expect(center.y).toBeLessThan(1);
        expect(center.width).toBe(44);
        expect(center.height).toBe(44);
      }
      const list = card.getByRole("list");
      const rows = await list
        .getByRole("listitem")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().height),
        );
      expect(rows).toEqual([68, 68, 68, 68]);
      const scroll = await list.evaluate((element) => ({
        content: element.scrollHeight,
        viewport: element.clientHeight,
      }));
      expect(scroll.content).toBeGreaterThan(scroll.viewport);
      await list.focus();
      await page.keyboard.press("End");
      await expect
        .poll(() => list.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      const title = list.getByText(longName, { exact: true });
      await expect(title).toHaveAttribute("title", longName);
      expect(
        await title.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
      expect((await card.boundingBox())!.height).toBe(260);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`fixed-active-${width}-${theme}.png`),
      });
      const scan = await new AxeBuilder({ page })
        .include(".active-timers-card")
        .analyze();
      expect(scan.violations).toEqual([]);
    }
  }
  await card.getByRole("button", { name: "Pause all", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Pause all timers?", exact: true })
    .getByRole("button", { name: "Pause all timers", exact: true })
    .click();
  expect((await card.boundingBox())!.height).toBe(260);
});
test("shows a tracking-only indicator away from Today", async ({ page }) => {
  const dock = page.locator(".active-dock");
  await expect(dock).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  await expect(dock).toHaveCount(0);
  for (const route of ["Calendar", "Insights", "Settings"]) {
    await page.getByRole("link", { name: route, exact: true }).first().click();
    await expect(dock).toContainText("Tracking");
    await expect(dock).toContainText("1 timer active");
    await expect(dock.getByRole("button")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await expect(dock).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start Portfolio project", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(dock).toContainText("2 timers active");
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page
    .locator(".active-timers-card")
    .getByRole("button", { name: "Pause all", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Pause all timers?", exact: true })
    .getByRole("button", { name: "Pause all timers", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(dock).toHaveCount(0);
});
test("pairs daily progress with active timers", async ({ page }, testInfo) => {
  for (const width of [1500, 768, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const card = page.locator(".daily-card");
      await expect(
        card.getByText("Today’s rhythm", { exact: true }),
      ).toBeVisible();
      await expect(card.getByText("of 8h 0m", { exact: true })).toBeVisible();
      const bounds = await card.boundingBox();

      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width === 1500) {
        expect(bounds!.height).toBeLessThanOrEqual(280);
        const active = await page.locator(".active-timers-card").boundingBox();
        expect(active!.x).toBeGreaterThan(bounds!.x + bounds!.width);
      }
      for (const button of await card.getByRole("button").all()) {
        await button.focus();
        const tooltip = card.locator('[role="tooltip"]:visible');
        const tooltipBounds = await tooltip.boundingBox();
        expect(tooltipBounds!.x).toBeGreaterThanOrEqual(0);
        expect(tooltipBounds!.x + tooltipBounds!.width).toBeLessThanOrEqual(
          width,
        );
      }
      await card.getByRole("heading").click();
      await expect(card.locator('[role="tooltip"]:visible')).toHaveCount(0);
      const scan = await new AxeBuilder({ page })
        .include(".today-grid")
        .analyze();
      expect(
        scan.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`daily-${width}-${theme}.png`),
      });
    }
  }
});
test("shows concurrent sessions in the active card and pauses them", async ({
  page,
}, testInfo) => {
  const card = page.locator(".active-timers-card");
  await expect(
    card.getByText("No timers running", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start Portfolio project", exact: true })
    .click();
  await expect(card.locator("li")).toHaveCount(2);
  await expect(
    card.getByText("No timers running", { exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("active-sessions.png") });
  const scan = await new AxeBuilder({ page })
    .include(".active-timers-card")
    .analyze();
  expect(scan.violations).toEqual([]);
  const duration = card.locator(".active-timer-duration").first();
  const before = await duration.textContent();
  await expect(duration).not.toHaveText(before!);
  await card
    .getByRole("button", {
      name: "Pause active timer Morning walk",
      exact: true,
    })
    .click();
  await expect(card.locator("li")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Start Morning walk", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  await card.getByRole("button", { name: "Pause all", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Pause all timers?",
    exact: true,
  });
  await expect(
    confirmation.getByRole("button", { name: "Keep running" }),
  ).toBeFocused();
  await expect(card.locator("li")).toHaveCount(2);
  await confirmation.getByRole("button", { name: "Keep running" }).click();
  await expect(confirmation).toBeHidden();
  await expect(card.locator("li")).toHaveCount(2);
  await card.getByRole("button", { name: "Pause all", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(card.locator("li")).toHaveCount(2);
  await card.getByRole("button", { name: "Pause all", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Pause all timers?", exact: true })
    .getByRole("button", { name: "Pause all timers", exact: true })
    .click();
  await expect(
    card.getByText("No timers running", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".task-list").getByRole("button", { name: /^Pause / }),
  ).toHaveCount(0);
});
test("centers the reached-limit confirmation and continues only by choice", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  const entry = page.getByRole("dialog");
  await entry.getByRole("combobox").click();
  await page.getByRole("option", { name: "Watch list", exact: true }).click();
  await entry.getByLabel("Hours", { exact: true }).fill("2");
  await entry.getByLabel("Minutes", { exact: true }).fill("0");
  await entry.getByRole("button", { name: "Add time", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  const trigger = page.getByRole("button", {
    name: "Continue Watch list",
    exact: true,
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Continue Watch list?",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Keep paused" }),
    ).toBeFocused();
    await expect(dialog).toContainText(
      "but the extra time will not be tracked.",
    );
    for (const label of ["Keep paused", "Continue anyway"]) {
      const button = dialog.getByRole("button", { name: label });
      const layout = await button.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          lines: range.getClientRects().length,
          fits: element.scrollWidth <= element.clientWidth,
        };
      });
      expect(layout.lines).toBe(1);
      expect(layout.fits).toBe(true);
    }
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds).not.toBeNull();
    expect(
      Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
    ).toBeLessThan(2);
    expect(
      Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2),
    ).toBeLessThan(2);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await dialog.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expect(
      dialog.getByText("Limit reached", { exact: true }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`limit-${theme}.png`) });
    await dialog.getByRole("button", { name: "Keep paused" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeVisible();
  }
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await trigger.click();
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Pause Watch list", exact: true })
    .click();
});

test("gives shared task actions a subtle hover lift", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Task list", exact: true }).click();
  const edit = page.getByRole("button", {
    name: "Edit saved task Morning walk",
  });
  await edit.hover();
  const styles = await edit.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      transform: computed.transform,
      transition: computed.transitionProperty,
      filter: computed.filter,
    };
  });
  if (testInfo.project.name === "chromium") {
    expect(styles.transform).not.toBe("none");
    expect(styles.transition).toContain("transform");
    expect(styles.filter).toContain("brightness");
  } else {
    expect(styles.transform).toBe("none");
  }
});

test("warns before closing a tab with a running timer", async ({ page }) => {
  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  const canceledCloseWarning = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const warning = await canceledCloseWarning;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  expect(page.isClosed()).toBe(false);
  await expect(
    page.getByRole("button", { name: "Pause Morning walk", exact: true }),
  ).toBeVisible();
  const acceptedCloseWarning = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const closed = page.waitForEvent("close");
  await (await acceptedCloseWarning).accept();
  await closed;
});

test("warns on reload while timers run and leaves internal navigation uninterrupted", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  const warning = page.waitForEvent("dialog");
  // A canceled reload may never reach Playwright's requested load state.
  const canceledReload = page.reload({ timeout: 3000 }).catch(() => null);
  const dialog = await warning;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await canceledReload;
  await expect(
    page.getByRole("button", { name: "Pause Morning walk", exact: true }),
  ).toBeVisible();

  const unexpectedDialogs: string[] = [];
  const rejectUnexpected = async (
    dialog: import("@playwright/test").Dialog,
  ) => {
    unexpectedDialogs.push(dialog.type());
    await dialog.dismiss();
  };
  page.on("dialog", rejectUnexpected);
  await page
    .getByRole("link", { name: "Calendar", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.getByRole("link", { name: "Today", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Pause Morning walk", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start Morning walk", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(unexpectedDialogs).toEqual([]);
  page.off("dialog", rejectUnexpected);

  await page
    .getByRole("button", { name: "Start Morning walk", exact: true })
    .click();
  const acceptedWarning = page.waitForEvent("dialog");
  const acceptedReload = page.reload();
  await (await acceptedWarning).accept();
  await acceptedReload;
  await expect(
    page.getByRole("heading", { name: "Morning walk", exact: true }),
  ).toBeVisible();
});

test("shows aligned task actions and dismisses with Escape or an outside click", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const trigger = page.getByRole("button", {
    name: "Actions for Morning walk",
  });
  const actions = page.getByRole("group", {
    name: "Task actions for Morning walk",
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await trigger.click();
    await expect(
      actions.getByRole("button", { name: "Move up", exact: true }),
    ).toBeDisabled();
    const aligned = await actions
      .getByRole("button", { name: "Edit", exact: true })
      .evaluate((button) => {
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        const row = button.getBoundingClientRect();
        return (
          Math.abs(icon.y + icon.height / 2 - (row.y + row.height / 2)) <= 1
        );
      });
    expect(aligned).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".task-menu").analyze())
        .violations,
    ).toEqual([]);
    await testInfo.attach(`task-actions-${theme}`, {
      body: await actions.screenshot(),
      contentType: "image/png",
    });
    await page.keyboard.press("Escape");
    await expect(actions).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
      .getByRole("heading", { name: "Morning walk", exact: true })
      .click();
    await expect(actions).toBeHidden();
  }
});

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
  await entry.getByRole("combobox").click();
  await page.getByRole("option", { name: "Watch list", exact: true }).click();
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
  await expect(history.filter({ hasText: "Manual addition" })).toContainText(
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
  await expect(page.locator(".active-timers-card li")).toHaveCount(2);
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause all" }).click();
  await page
    .getByRole("dialog", { name: "Pause all timers?", exact: true })
    .getByRole("button", { name: "Pause all timers", exact: true })
    .click();
  await expect(page.locator(".active-timers-card li")).toHaveCount(0);

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
}, testInfo) => {
  test.setTimeout(60_000);
  await page.getByRole("button", { name: "Start Morning walk" }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause Morning walk" }).click();
  await page.getByRole("link", { name: "Calendar" }).first().click();

  await page
    .getByRole("button", { name: "Entry actions for Morning walk" })
    .click();
  await page.getByRole("menuitem", { name: "Edit entry", exact: true }).click();
  await page.getByLabel("Hours").fill("1");
  await page.getByLabel("Minutes").fill("0");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("button", { name: "Entry actions for Morning walk" }),
  ).toBeFocused();

  await expect(page.getByText("Timer · corrected")).toBeVisible();
  for (const width of [1500, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const row = page.locator(".history-entry");
      await expect(row.locator("button")).toHaveCount(1);
      expect(
        await row.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      const actions = page.getByRole("button", {
        name: "Entry actions for Morning walk",
      });
      await actions.click();
      await expect(
        page.getByRole("menuitem", {
          name: "Restore original time",
          exact: true,
        }),
      ).toBeVisible();
      const scan = await new AxeBuilder({ page })
        .include(".history-actions-menu")
        .analyze();
      expect(scan.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`history-actions-${width}-${theme}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(actions).toBeFocused();
    }
  }
  await page
    .getByRole("button", { name: "Entry actions for Morning walk" })
    .click();
  await page
    .getByRole("menuitem", { name: "Restore original time", exact: true })
    .click();

  await expect(page.getByText("Timer · corrected")).toBeHidden();
  await expect(
    page.getByRole("menuitem", { name: "Restore original time", exact: true }),
  ).toBeHidden();
  const actions = page.getByRole("button", {
    name: "Entry actions for Morning walk",
  });
  await actions.click();
  await page
    .getByRole("menuitem", { name: "Delete entry", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(actions).toBeFocused();
  await expect(page.locator(".history-entry")).toHaveCount(1);
  await actions.click();
  await page
    .getByRole("menuitem", { name: "Delete entry", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete tracked entry?" })
    .getByRole("button", { name: "Delete entry", exact: true })
    .click();
  await expect(page.locator(".history-entry")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Tracked entries", exact: true }),
  ).toBeFocused();
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
  const sourceOptions = dialog.locator(".task-source-options");
  const measureSourceOptions = async () => {
    const buttonWidths = await sourceOptions
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().width),
      );
    const sliderWidth = await sourceOptions.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element, "::before").width),
    );
    return { buttonWidths, sliderWidth };
  };
  const newTaskOptions = await measureSourceOptions();
  await dialog.getByRole("button", { name: "From task list" }).click();
  await expect(dialog.getByLabel("Find a saved task")).toBeVisible();
  await dialog.getByLabel("Find a saved task").fill("no matching tasks");
  await expect
    .poll(async () => (await sourceOptions.boundingBox())!.height)
    .toBeLessThanOrEqual(52);
  await dialog.getByLabel("Find a saved task").clear();
  const savedTaskOptions = await measureSourceOptions();
  for (const { buttonWidths, sliderWidth } of [
    newTaskOptions,
    savedTaskOptions,
  ]) {
    expect(Math.abs(buttonWidths[0]! - buttonWidths[1]!)).toBeLessThan(1);
    expect(Math.abs(buttonWidths[0]! - sliderWidth)).toBeLessThan(1);
  }
  await dialog.getByRole("button", { name: "New task" }).click();
  await expect(dialog.getByLabel("Task name")).toBeVisible();
  await expect
    .poll(async () => (await sourceOptions.boundingBox())!.height)
    .toBeLessThanOrEqual(52);
  await expect
    .poll(() =>
      dialog
        .locator(".task-dialog-body")
        .evaluate((element) =>
          Math.abs(
            element.getBoundingClientRect().height -
              (element.firstElementChild as HTMLElement).scrollHeight,
          ),
        ),
    )
    .toBeLessThan(0.5);
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
