import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("introduces TimeEight before sign-in and previews the core app", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /understand your time without judging your day/i,
    }),
  ).toBeVisible();
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
    page.getByRole("heading", { name: /patterns without scores/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Continue to TimeEight" }),
  ).toBeInViewport();

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
});
