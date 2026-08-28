import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../../e2e-assertions";

const cases = [
  {
    name: "overview-wide-light",
    path: "/en",
    heading: "Engineering",
    contract: "index",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "overview-tablet-light",
    path: "/ko",
    heading: "Engineering",
    contract: "index",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "overview-mobile-dark",
    path: "/en",
    heading: "Engineering",
    contract: "index",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "cilium-series-wide-light",
    path: "/ko/series/cilium-gateway-api",
    heading: "Cilium Gateway API 외부 트래픽 설계",
    contract: "series",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "domain-design-series-mobile-dark",
    path: "/en/series/domain-driven-design",
    heading: "Domain-Driven Design",
    contract: "series",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "frontend-docs-tutorial-wide-light",
    path: "/ko/docs/fe/tutorial-maintainable-tailwind-shadcn",
    heading: "유지보수 가능한 Tailwind와 shadcn/ui 기능 만들기",
    contract: "docs-article",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "frontend-docs-explanation-mobile-dark",
    path: "/en/docs/fe/why-tailwind-shadcn-maintainability-needs-ownership",
    heading: "Tailwind and shadcn/ui Maintainability Starts with Ownership",
    contract: "docs-article",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "frontend-docs-playwright-mobile-light",
    path: "/ko/docs/fe/playwright-visual-regression-testing",
    heading: "Playwright로 유의미한 시각 회귀 테스트 만들기",
    contract: "docs-article",
    width: 390,
    height: 844,
    theme: "light",
  },
  {
    name: "ddd-wide-light",
    path: "/ko/ddd",
    heading: "실전 도메인 주도 설계 핸드북",
    contract: "article",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "article-dark",
    path: "/en/typescript-7-compatibility",
    heading: "TypeScript 7 Compatibility",
    contract: "article",
    width: 1440,
    height: 1000,
    theme: "dark",
  },
  {
    name: "deep-dive-tablet",
    path: "/en/nextjs-16",
    heading: "Next.js 16",
    contract: "article",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "deep-dive-mobile-light",
    path: "/en/pnpm-11",
    heading: "pnpm 11",
    contract: "article",
    width: 390,
    height: 844,
    theme: "light",
  },
  {
    name: "ddd-tablet-dark",
    path: "/ko/ddd",
    heading: "실전 도메인 주도 설계 핸드북",
    contract: "article",
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
    if (visualCase.contract === "index") {
      await expect(
        page.getByRole("navigation", {
          name: visualCase.path.startsWith("/ko") ? "모든 글" : "All articles",
        }),
      ).toBeVisible();
    } else if (visualCase.contract === "series") {
      const documentGrid = page.locator('[data-document-grid="true"]');
      await expect(documentGrid).toBeVisible();
      await expect
        .poll(() => documentGrid.getByRole("link").count())
        .toBeGreaterThan(0);
    } else {
      const article = page.getByRole("article");
      await expect(article).toBeVisible();
      await expect(
        page.getByRole("navigation", {
          name: visualCase.path.startsWith("/ko") ? "현재 위치" : "Breadcrumb",
          includeHidden: true,
        }),
      ).toBeAttached();
      if (visualCase.contract === "docs-article") {
        await expect(
          article.getByRole("link", { name: "FE", exact: true }),
        ).toHaveAttribute("href", `${visualCase.path.slice(0, 3)}/docs/fe`);
        if (visualCase.width > 960) {
          await expect(
            page.getByRole("navigation", {
              name: visualCase.path.startsWith("/ko")
                ? "프론트엔드 문서"
                : "Frontend Documents",
            }),
          ).toBeVisible();
        } else {
          await expect(
            page.getByText(
              visualCase.path.startsWith("/ko")
                ? "이 분야의 문서 목록"
                : "Documents in this area",
              { exact: true },
            ),
          ).toBeVisible();
        }
        if (visualCase.name === "frontend-docs-playwright-mobile-light") {
          const tableScroll = article
            .locator('[data-docs-table-scroll="true"]')
            .first();
          await expect(tableScroll).toBeVisible();
          await expect
            .poll(() =>
              tableScroll.evaluate((element) => ({
                isContained:
                  element.getBoundingClientRect().right <=
                  document.documentElement.clientWidth,
                isScrollable: element.scrollWidth > element.clientWidth,
              })),
            )
            .toEqual({
              isContained: true,
              isScrollable: true,
            });
        }
      }
    }

    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), {
                once: true,
              });
              image.addEventListener("error", () => resolve(), {
                once: true,
              });
            });
          }
          await image.decode().catch(() => undefined);
        }),
      );
    });
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
      fullPage: true,
      timeout: 15_000,
    });
  });
}
