import { expect, test } from "@playwright/test";

function canvasChecksum(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d");
  if (context === null || canvas.width === 0 || canvas.height === 0) return 0;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let checksum = 2_166_136_261;
  for (let index = 0; index < pixels.length; index += 97) {
    checksum = Math.imul(checksum ^ (pixels[index] ?? 0), 16_777_619);
  }
  return checksum >>> 0;
}

test("server monitoring demos load near the viewport and animate on canvas", async ({ page }) => {
  await page.goto("/ko/deep-dive/server-monitoring-analysis-guide");

  await expect(
    page.getByRole("heading", { level: 1, name: "서버 모니터링 분석 가이드" }),
  ).toBeVisible();
  const demos = page.locator("[data-server-monitoring-demo]");
  await expect(demos).toHaveCount(18);
  await expect(demos.last().locator("canvas")).toHaveCount(0);

  const firstDemo = demos.first();
  await firstDemo.scrollIntoViewIfNeeded();
  const canvas = firstDemo.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.evaluate((element) => element.width > 0 && element.height > 0))
    .toBe(true);

  const firstFrame = await canvas.evaluate(canvasChecksum);
  expect(firstFrame).not.toBe(0);
  await expect.poll(() => canvas.evaluate(canvasChecksum)).not.toBe(firstFrame);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
