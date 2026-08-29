import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

test("[실패] 수평 바닥 바닥 없이 더블 언어 빈 연구 보고서를 제출함", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page).toHaveTitle(/Investment Notes/u);
  await expect(
    page.getByRole("link", { name: "jongminchung invest" }),
  ).toContainText("jongminchunginvest");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Investment research grounded in filings and primary sources",
  );
  const initialResults = page.locator('[data-document-grid="true"]');
  await expect(initialResults).toBeVisible();
  await expect(initialResults.getByRole("link")).toHaveCount(9);
  const editorialImages = page.locator('[data-editorial-image="true"]');
  await expect(editorialImages.first()).toBeVisible();
  expect(await editorialImages.count()).toBeGreaterThanOrEqual(5);
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", "https://invest.jamie.kr/en");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://invest.jamie.kr/investment-notes-og.png",
  );
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page);
});

test("[성공] 관계자 투자 관찰 파일을 게시함", async ({ siteRequest }) => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/en/rss.xml"]) {
    const response = await siteRequest.get(path);
    expect(response.ok(), path).toBe(true);
  }
  const sitemap = await (await siteRequest.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/series/operating-notes");
  expect(sitemap).toContain("/en/sources/article");
  expect(sitemap).not.toContain("/en/sources/book");
});

test("[성공] 투자 노트와 collection의 검색 엔터티를 연결함", async ({
  page,
}) => {
  await page.goto("/en/notes/efficiency-compounds");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://invest.jamie.kr/en/notes/efficiency-compounds",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://invest.jamie.kr/invest/efficiency-feedback-loop.png",
  );
  await expect(page.locator('[data-investment-hero="true"]')).toHaveAttribute(
    "src",
    /efficiency-feedback-loop\.png/u,
  );
  await expect(
    page.locator('meta[property="article:published_time"]'),
  ).toHaveAttribute("content", "2026-07-29");
  await expect(
    page.getByRole("link", { name: "Operating notes", exact: true }),
  ).toHaveAttribute("href", "/en/series/operating-notes");
  await expect(page.getByRole("link", { name: "#efficiency" })).toHaveAttribute(
    "href",
    "/en/tags/efficiency",
  );
  const schemaTypes = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.flatMap((script) => {
        const schema = JSON.parse(script.textContent ?? "{}") as {
          "@type"?: string;
          "@graph"?: { "@type"?: string }[];
        };
        return (
          schema["@graph"]?.map((node) => node["@type"] ?? "") ?? [
            schema["@type"] ?? "",
          ]
        );
      }),
    );
  expect(schemaTypes).toEqual(
    expect.arrayContaining(["WebSite", "Article", "BreadcrumbList"]),
  );

  await page.goto("/en/series/Operating%20notes");
  await expect(page).toHaveURL(/\/en\/series\/operating-notes$/u);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://invest.jamie.kr/en/series/operating-notes",
  );

  await page.goto("/en/sources/book");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/u,
  );
});

test("[성공] 투자 장소를 선택하고 기억함", async ({ page }) => {
  await page.goto("/ko");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "공시와 원문",
  );
  expect(
    (await page.context().cookies()).find(
      ({ name }) => name === "invest-locale",
    )?.value,
  ).toBe("ko");
});

test("[성공] 투자 글에 Tech와 같은 문서 내 목차를 제공함", async ({ page }) => {
  await page.goto("/en/notes/reading-the-13f-difference");

  const outline = page.getByRole("navigation", { name: "Document outline" });
  await expect(outline).toBeVisible();
  await expect(
    outline.getByRole("link", {
      name: "Start by limiting what a 13F can tell us",
    }),
  ).toHaveAttribute("href", "#start-by-limiting-what-a-13f-can-tell-us");
  await expect(page.getByText("Jamie's notes", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source summary", { exact: true })).toHaveCount(
    0,
  );
});

test("[성공] Invest 코드블록이 Tech 타이포그래피와 외형을 공유함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/fixtures/code-block");

  const codeBlock = page.locator('[data-docs-code-block="true"]');
  const viewport = codeBlock.getByRole("region", {
    name: /Code block: analysis\.ts/u,
  });
  await expect(codeBlock).toBeVisible();
  await expect(
    codeBlock.getByRole("button", { name: "Copy Text" }),
  ).toBeVisible();
  await expect(
    viewport.evaluate((element) => {
      const viewportStyle = getComputedStyle(element);
      const figureStyle = getComputedStyle(
        element.closest('[data-docs-code-block="true"]')!,
      );
      return {
        borderStyle: figureStyle.borderStyle,
        fontSize: viewportStyle.fontSize,
        letterSpacing: viewportStyle.letterSpacing,
        lineHeight: viewportStyle.lineHeight,
        overflowX: viewportStyle.overflowX,
        overflowY: viewportStyle.overflowY,
      };
    }),
  ).resolves.toEqual({
    borderStyle: "solid",
    fontSize: "13px",
    letterSpacing: "normal",
    lineHeight: "20.8px",
    overflowX: "auto",
    overflowY: "auto",
  });
  await expectNoHorizontalOverflow(page);
});

test("[성공] Invest 목록 제어가 URL 상태와 선택 결과를 일치시킴", async ({
  page,
}) => {
  await page.goto("/en?view=list&sort=oldest");
  await expect(page.locator("[data-view=list]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Newest" })).toHaveAttribute(
    "href",
    /view=list/u,
  );
});

test("[성공] Invest 테마 선택을 적용하고 사이트별로 저장함", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("invest-theme", "dark"));
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Theme: dark" }).click();
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("invest-theme"))).toBe(
    "system",
  );
});
