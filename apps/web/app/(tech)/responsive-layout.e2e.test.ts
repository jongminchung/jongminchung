import { expect, test } from "@playwright/test";
import {
  expectContainedHorizontalScroller,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";

const layoutCases = [
  {
    name: "태블릿 index",
    path: "/ko",
    heading: "Engineering",
    width: 1024,
    height: 900,
    theme: "light",
    surface: "index",
  },
  {
    name: "데스크톱 series",
    path: "/ko/series/building-from-first-principles",
    heading: "바닥부터 직접 만들어보기",
    width: 1440,
    height: 1000,
    theme: "light",
    surface: "collection",
  },
  {
    name: "데스크톱 tutorial",
    path: "/ko/docs/fe/tutorial-maintainable-tailwind-shadcn",
    heading: "유지보수 가능한 Tailwind와 shadcn/ui 기능 만들기",
    width: 1440,
    height: 1000,
    theme: "light",
    surface: "docs",
  },
  {
    name: "다크 태블릿 docs",
    path: "/ko/docs/be/ddd",
    heading: "실전 도메인 주도 설계 핸드북",
    width: 1024,
    height: 900,
    theme: "dark",
    surface: "docs",
  },
] as const;

test.describe("Tech 반응형 레이아웃 계약", () => {
  for (const layoutCase of layoutCases) {
    test(`${layoutCase.name}에서 핵심 콘텐츠와 탐색을 유지함`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: layoutCase.width,
        height: layoutCase.height,
      });
      await page.addInitScript(
        (theme) => localStorage.setItem("tech-theme", theme),
        layoutCase.theme,
      );
      await page.goto(layoutCase.path);

      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        layoutCase.theme,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: layoutCase.heading }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      if (layoutCase.surface === "index") {
        await expect(
          page.getByRole("navigation", { name: "모든 글" }),
        ).toBeVisible();
      } else if (layoutCase.surface === "docs") {
        await expect(page.getByRole("article")).toBeVisible();
        await expect(page.locator("#nd-sidebar")).toBeVisible();
      }
    });
  }

  test("모바일 표는 페이지를 넘치지 않고 자체 스크롤됨", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ko/docs/fe/playwright-visual-regression-testing");

    const article = page.getByRole("article");
    const tableScroller = article
      .locator('[data-docs-table-scroll="true"]')
      .first();
    await expect(article).toBeVisible();
    await expect(tableScroller).toBeVisible();
    await expectContainedHorizontalScroller(tableScroller);
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("button", { name: "Open Sidebar" }),
    ).toBeVisible();
  });
});
