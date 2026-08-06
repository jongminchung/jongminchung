import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("plain documents do not download the Motion-powered material renderer", async ({ page }) => {
  let materialRendererLoaded = false;
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const source = await response.text().catch(() => "");
    if (source.includes("material-gradient-")) materialRendererLoaded = true;
  });

  await page.goto("/en/overview");
  await page.waitForLoadState("networkidle");
  expect(materialRendererLoaded).toBe(false);

  await page.goto("/en/deep-dive/server-monitoring-analysis-guide");
  const demo = page.locator(
    '[data-material-demo="server-monitoring-analysis-guide/TrafficPatternDemo"]',
  );
  await demo.scrollIntoViewIfNeeded();
  await expect(demo.locator("svg")).toBeVisible();
  await expect.poll(() => materialRendererLoaded).toBe(true);
});

test("material demos preload near the viewport, animate as SVG, and pause offscreen", async ({
  page,
}) => {
  await page.goto("/ko/deep-dive/server-monitoring-analysis-guide");

  await expect(
    page.getByRole("heading", { level: 1, name: "서버 모니터링 분석 가이드" }),
  ).toBeVisible();
  const demos = page.locator("[data-material-demo]");
  await expect(demos).toHaveCount(19);
  await expect(demos.last().locator("svg, canvas")).toHaveCount(0);

  const firstDemo = page.locator(
    '[data-material-demo="server-monitoring-analysis-guide/TrafficPatternDemo"]',
  );
  await firstDemo.scrollIntoViewIfNeeded();
  const svg = firstDemo.locator("svg");
  await expect(svg).toBeVisible();
  await expect.poll(() => svg.locator(":scope > *").count()).toBeGreaterThan(5);

  const firstFrame = await svg.innerHTML();
  await expect.poll(() => svg.innerHTML()).not.toBe(firstFrame);

  await demos.last().scrollIntoViewIfNeeded();
  await expect(firstDemo.locator("svg")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("reduced motion renders a stable representative SVG frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/deep-dive/server-monitoring-analysis-guide");
  const demo = page.locator(
    '[data-material-demo="server-monitoring-analysis-guide/TrafficPatternDemo"]',
  );
  await demo.scrollIntoViewIfNeeded();
  const svg = demo.locator("svg");
  await expect(svg).toBeVisible();
  await expect.poll(() => svg.locator(":scope > *").count()).toBeGreaterThan(5);
  const frame = await svg.innerHTML();
  await page.waitForTimeout(250);
  expect(await svg.innerHTML()).toBe(frame);
});

test("pixel-processing exceptions remain native Canvas and material frames are accessible", async ({
  page,
}) => {
  await page.goto("/en/deep-dive/the-expensive-main-thread");
  const demo = page.locator('[data-material-demo="the-expensive-main-thread/DynamicPriorityDemo"]');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-material-renderer", "canvas");
  await expect(demo.getByRole("button", { name: "Attach 60 photos" })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include("[data-material-demo]").analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
