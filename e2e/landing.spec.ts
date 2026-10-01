import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("introduces TimeEight before sign-in and previews the core app", async ({
  page,
}) => {
  await page.goto("/login");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect(page.locator("html")).toHaveAttribute(
    "data-scroll-behavior",
    "smooth",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
    )
    .toBe("smooth");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /start a timer.*understand your day/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/calm, intentional time tracking/i)).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("img", {
      name: /preview of the TimeEight Today dashboard/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /timers with intention/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your time in context/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /see your patterns/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /local demo/i })).toHaveCount(0);

  await page
    .getByRole("link", { name: "See inside the app", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /from the timer you start to the patterns you notice/i,
    }),
  ).toBeInViewport();
  await expect(page).toHaveURL(/#inside$/);

  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Continue to TimeEight" }),
  ).toBeInViewport();
  await expect(page).toHaveURL(/#signin$/);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
    )
    .toBe("auto");

  const seriousViolations = (
    await new AxeBuilder({ page }).include(".landing-page").analyze()
  ).violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousViolations).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBe(dimensions.viewport);

  const calendarBounds = await page.evaluate(() => {
    const calendar = document.querySelector(".landing-mini-calendar");
    const days = [...document.querySelectorAll(".landing-mini-days span")];
    if (!calendar || days.length === 0) return null;
    const container = calendar.getBoundingClientRect();
    const dayBounds = days.map((day) => day.getBoundingClientRect());
    return {
      containerLeft: container.left,
      containerRight: container.right,
      firstDayLeft: Math.min(...dayBounds.map((day) => day.left)),
      lastDayRight: Math.max(...dayBounds.map((day) => day.right)),
    };
  });
  expect(calendarBounds).not.toBeNull();
  expect(calendarBounds!.firstDayLeft).toBeGreaterThanOrEqual(
    calendarBounds!.containerLeft,
  );
  expect(calendarBounds!.lastDayRight).toBeLessThanOrEqual(
    calendarBounds!.containerRight,
  );
});

test("fits each landing section within a 16:9 desktop frame", async ({
  page,
}, testInfo) => {
  for (const { width, height } of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");

    const frames = await page.evaluate(() => {
      const sectionHeight = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      return {
        viewport: window.innerHeight,
        hero: sectionHeight(".landing-header") + sectionHeight(".landing-hero"),
        intro: sectionHeight(".landing-intro"),
        signin:
          sectionHeight(".landing-signin") + sectionHeight(".landing-footer"),
      };
    });

    expect(frames.hero).toBeLessThanOrEqual(frames.viewport + 2);
    expect(frames.intro).toBeLessThanOrEqual(frames.viewport + 2);
    expect(frames.signin).toBeLessThanOrEqual(frames.viewport + 2);
    await page.screenshot({
      path: testInfo.outputPath(`landing-${width}x${height}.png`),
      fullPage: true,
    });
  }
});
