import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectPageToMatchScreenshot,
} from "../../e2e-assertions";

const cases = [
  { name: "readme-wide-light", width: 1440, height: 1000, theme: "light" },
  { name: "readme-mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

test.describe("Home 시각 회귀", () => {
  for (const visualCase of cases) {
    test(`${visualCase.name} 기준 화면을 유지함`, async ({ page }) => {
      await page.setViewportSize({
        width: visualCase.width,
        height: visualCase.height,
      });
      await page.addInitScript(
        (theme) => localStorage.setItem("home-theme", theme),
        visualCase.theme,
      );
      await page.goto("/");

      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        visualCase.theme,
      );
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectPageToMatchScreenshot(page, `${visualCase.name}.png`);
    });
  }
});
