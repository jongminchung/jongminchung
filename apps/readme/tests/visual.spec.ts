import { expect, test } from "@playwright/test";

const cases = [
  { name: "readme-wide", width: 1440, height: 1000 },
  { name: "readme-mobile", width: 390, height: 844 },
] as const;

for (const visualCase of cases) {
  test(`visual: ${visualCase.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    });
    await page.goto("/");
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  });
}
