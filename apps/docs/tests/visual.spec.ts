import { expect, test } from "@playwright/test";

const cases = [
  {
    name: "overview-wide-light",
    path: "/en/overview",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "overview-tablet-light",
    path: "/ko/overview",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "overview-mobile-dark",
    path: "/en/overview",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "ddd-wide-light",
    path: "/ko/handbook/ddd",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "package-dark",
    path: "/en/packages/ui",
    width: 1440,
    height: 1000,
    theme: "dark",
  },
  {
    name: "deep-dive-tablet",
    path: "/en/deep-dive/nextjs-16",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "deep-dive-mobile-light",
    path: "/en/deep-dive/pnpm-11",
    width: 390,
    height: 844,
    theme: "light",
  },
  {
    name: "ddd-tablet-dark",
    path: "/ko/handbook/ddd",
    width: 1024,
    height: 900,
    theme: "dark",
  },
] as const;

for (const visualCase of cases) {
  test(`visual: ${visualCase.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    });
    await page.addInitScript(
      (theme) => localStorage.setItem("docs-theme", theme),
      visualCase.theme,
    );
    await page.goto(visualCase.path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  });
}
