import { expect, test } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";

test("[성공] 캔팅된 사이트를 사용하고 외부 플로어 주차장을 주차함", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Engineering",
  );
  await expect(page.locator("html")).toHaveAttribute("data-site", "tech");
  await expect(
    page.getByRole("link", { name: "jongminchung tech" }).first(),
  ).toContainText("jongminchungtech");
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page);
});

test("[성공] 목록 제어를 URL과 동기화하고 후속 페이지 링크를 제공함", async ({
  page,
}) => {
  await page.goto("/en?sort=oldest&view=list&page=2");
  await expect(page.locator("[data-view=list]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Newest" })).toHaveAttribute(
    "href",
    /view=list/u,
  );
  await expect(page.getByRole("link", { name: "Grid" })).toHaveAttribute(
    "href",
    /sort=oldest/u,
  );
});

test("[성공] 생성된 기사 데이터를 검색하고 여러 지역에서 기사를 싫어함", async ({
  page,
}) => {
  await page.goto("/en");
  const trigger = page.locator("[data-docs-search-trigger]:visible").first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  const input = dialog.getByRole("combobox");
  await input.fill("Next.js 16");
  const result = dialog.getByRole("option", { name: /Next\.js 16/u });
  await expect(result).toBeVisible();
  await input.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await input.fill("Next.js 16");
  await expect(result).toBeVisible();
  await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).not.toBeNull();
  const activeOption = page.locator(`[id="${activeId}"]`);
  await expect(activeOption).toHaveRole("option");
  await expect(activeOption).toContainText("Collaboration");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/en\/articles\/collaboration$/u);
  await page.getByRole("link", { name: "한국어로 읽기" }).click();
  await expect(page).toHaveURL(/\/ko\/articles\/collaboration$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});

test("[성공] 오류 검색 요청을 재시도함", async ({ page }) => {
  let requests = 0;
  await page.route("**/en/search-index", async (route) => {
    requests += 1;
    if (requests <= 2)
      await route.fulfill({ status: 503, body: "unavailable" });
    else await route.continue();
  });
  await page.goto("/en");
  await page.locator("[data-docs-search-trigger]:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });

  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Retry" }).click();
  await expect(dialog.getByRole("option").first()).toBeVisible();
  expect(requests).toBe(3);
});

test("[성공] 기록 및 동일 페이지에 대한 기본 링크를 사용함", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Handbook" }).first().click();
  await expect(page).toHaveURL(/\/en\/series\/handbook$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/en$/u);

  await page.goto("/en/articles/nextjs-16");
  const hashLink = page.locator('a[href^="#"]:visible').first();
  const hash = await hashLink.getAttribute("href");
  await hashLink.click();
  await expect(page).toHaveURL(new RegExp(`${hash}$`, "u"));
});

test("[성공] 경로를 다시 방문해도 모바일 탐색을 닫힌 상태로 시작함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/articles/nextjs-16");
  await page.getByRole("button", { name: "Open navigation" }).click();

  const navigation = page.getByRole("dialog", {
    name: "Mobile documentation navigation",
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "TypeScript 6" }).click();
  await expect(page).toHaveURL(/\/en\/articles\/typescript-6$/u);

  await page.goBack();
  await expect(page).toHaveURL(/\/en\/articles\/nextjs-16$/u);
  await expect(navigation).toBeHidden();
});

test("[성공] 각주 참조와 본문 사이를 이동함", async ({ page }) => {
  await page.goto("/en/articles/the-expensive-main-thread");

  const reference = page.locator("[data-footnote-ref]").first();
  const footnote = page.locator("#user-content-fn-1");
  await reference.click();

  await expect(page).toHaveURL(/#user-content-fn-1$/u);
  await expect(footnote).toBeInViewport();

  await footnote.locator("[data-footnote-backref]").click();
  await expect(page).toHaveURL(/#user-content-fnref-1$/u);
  await expect(reference).toBeInViewport();
});

test("[성공] 버퍼를 로드하고 기술 검색 파일을 게시함", async ({
  page,
  request,
}) => {
  await page.goto("/diagrams");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Diagrams",
  );
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/en/rss.xml",
    "/llms.txt",
  ]) {
    expect((await request.get(path)).ok(), path).toBe(true);
  }
});

test("[성공] 정적 SVG와 원본 다운로드를 제공함", async ({ page }) => {
  await page.goto("/diagrams/operating-system");
  const diagram = page.getByRole("figure", {
    name: "operating-system.excalidraw",
  });

  await expect(diagram).toHaveAttribute("data-excalidraw-state", "ready");
  await expect(diagram).toHaveAttribute("data-rendered-element-count", "10");
  await expect(diagram).toHaveAttribute("data-source-element-count", "10");
  await expect(diagram.locator("img").first()).toHaveAttribute(
    "src",
    /\.light\.svg$/u,
  );
  await expect(
    diagram.getByRole("link", { name: "Download source" }),
  ).toHaveAttribute("href", "/diagrams/operating-system.excalidraw");
});

test("[성공] 신비한 기술 로케일을 반응으로 기억함", async ({ page }) => {
  await page.goto("/ko");
  expect(
    (await page.context().cookies()).find(({ name }) => name === "tech-locale")
      ?.value,
  ).toBe("ko");
});

test("[성공] 원시 원시 테마 선호도를 수화하고 유지함", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tech-theme", "dark"));
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const themeControl = page.getByRole("button", { name: "Theme: dark" });
  await expect(themeControl).toBeVisible();
  await themeControl.click();
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("tech-theme"))).toBe(
    "system",
  );
});
