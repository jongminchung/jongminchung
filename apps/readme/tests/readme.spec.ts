import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("presents Jamie's work with valid metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Jamie — Jongmin Chung");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Complex systemsshould explainthemselves.",
  );
  await expect(page.locator('[data-project="true"]')).toHaveCount(4);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://jamie.kr");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/,
  );
  await expect(page.getByRole("link", { name: "Jamie home" }).locator("img")).toHaveAttribute(
    "alt",
    "",
  );
});

test("publishes domain discovery files", async ({ request }) => {
  const [favicon, robots, sitemap, socialImage] = await Promise.all([
    request.get("/icon.svg"),
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/opengraph-image"),
  ]);

  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<text");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("https://jamie.kr/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://jamie.kr");
  expect(socialImage.ok()).toBe(true);
  expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("keeps the mobile layout within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
});
