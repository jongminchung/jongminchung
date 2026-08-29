import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../../e2e-assertions";

const cases = [
  { name: "readme-wide-light", width: 1440, height: 1000, theme: "light" },
  { name: "readme-mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

for (const visualCase of cases) {
  test(`visual: ${visualCase.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    });
    await page.addInitScript(
      (theme) => localStorage.setItem("home-theme", theme),
      visualCase.theme,
    );
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`);
  });
}
