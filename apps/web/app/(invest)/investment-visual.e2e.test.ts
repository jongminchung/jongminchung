import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectPageToMatchScreenshot,
} from "../../e2e-assertions";

const cases = [
  {
    name: "investment-wide-light",
    path: "/en",
    heading: "Investment research grounded in filings and primary sources",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "investment-mobile-dark",
    path: "/en",
    heading: "Investment research grounded in filings and primary sources",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "investment-note-mobile-light",
    path: "/ko/notes/reading-the-13f-difference",
    heading:
      "같은 13F라도 버핏, 드러켄밀러, 브리지워터는 전혀 다르게 읽어야 함",
    width: 390,
    height: 844,
    theme: "light",
  },
] as const;

test.describe("Invest 시각 회귀", () => {
  for (const visualCase of cases) {
    test(`${visualCase.name} 기준 화면을 유지함`, async ({ page }) => {
      await page.setViewportSize({
        width: visualCase.width,
        height: visualCase.height,
      });
      await page.addInitScript(
        (theme) => localStorage.setItem("invest-theme", theme),
        visualCase.theme,
      );
      await page.goto(visualCase.path);

      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        visualCase.theme,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: visualCase.heading }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectPageToMatchScreenshot(page, `${visualCase.name}.png`);
    });
  }
});
