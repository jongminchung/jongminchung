import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectPageToMatchScreenshot,
} from "../../e2e-assertions";

const cases = [
  {
    name: "overview-wide-light",
    path: "/en",
    heading: "Engineering",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "overview-mobile-dark",
    path: "/en",
    heading: "Engineering",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "docs-root-wide-light",
    path: "/en/docs",
    heading: "Docs",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "frontend-docs-explanation-mobile-dark",
    path: "/en/docs/fe/why-tailwind-shadcn-maintainability-needs-ownership",
    heading: "Tailwind and shadcn/ui Maintainability Starts with Ownership",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "ddd-wide-light",
    path: "/ko/docs/be/ddd",
    heading: "실전 도메인 주도 설계 핸드북",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "server-monitoring-wide-light",
    path: "/ko/server-monitoring-analysis-guide",
    heading: "서버 모니터링 분석 가이드",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "server-monitoring-mobile-light",
    path: "/ko/server-monitoring-analysis-guide",
    heading: "서버 모니터링 분석 가이드",
    width: 390,
    height: 844,
    theme: "light",
  },
] as const;

test.describe("Tech 시각 회귀", () => {
  for (const visualCase of cases) {
    test(`${visualCase.name} 기준 화면을 유지함`, async ({ page }) => {
      await page.setViewportSize({
        width: visualCase.width,
        height: visualCase.height,
      });
      await page.addInitScript(
        (theme) => localStorage.setItem("tech-theme", theme),
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
