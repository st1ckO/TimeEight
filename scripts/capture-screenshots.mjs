import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const output = "docs/screenshots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

async function capture(
  name,
  viewport,
  path = "/today",
  ready = "Morning walk",
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`http://localhost:3000${path}`);
  await page.getByRole("heading", { name: ready }).waitFor();
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  await context.close();
}

await capture("today-desktop", { width: 1440, height: 1000 });
await capture("today-mobile", { width: 390, height: 844 });
await capture(
  "calendar-desktop",
  { width: 1440, height: 1000 },
  "/calendar",
  "Calendar",
);
await browser.close();
