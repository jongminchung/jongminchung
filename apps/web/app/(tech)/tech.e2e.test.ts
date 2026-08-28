import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

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
  test.setTimeout(75_000);
  await page.goto("/en");
  const trigger = page.locator("[data-docs-search-trigger]:visible").first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  const input = dialog.getByRole("combobox");
  await input.fill("Next.js 16");
  const result = dialog.locator(
    '[role="option"][data-href="/en/docs/fe/nextjs-16"]',
  );
  await expect(result).toBeVisible({ timeout: 45_000 });
  await expect(result).toContainText("Reference");
  await expect(result).toContainText("Frontend");
  await input.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await input.fill("Next.js 16");
  await expect(result).toBeVisible({ timeout: 45_000 });
  const selectedHref = await result.getAttribute("data-href");
  if (selectedHref === null) throw new Error("Search result has no href");
  await result.click();
  await expect(page).toHaveURL(new RegExp(`${selectedHref}$`, "u"));
  const translatedHref = selectedHref
    .replace(/^\/en/u, "/ko")
    .replace(/#.*$/u, "");
  await page.getByRole("link", { name: "한국어로 읽기" }).click();
  await expect(page).toHaveURL(new RegExp(`${translatedHref}$`, "u"));
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});

test("[성공] 오류 검색 요청을 재시도함", async ({ page }) => {
  test.setTimeout(60_000);
  let requests = 0;
  await page.route("**/en/search*", async (route) => {
    requests += 1;
    if (requests === 1)
      await route.fulfill({ status: 503, body: "unavailable" });
    else await route.continue();
  });
  await page.goto("/en");
  await page.locator("[data-docs-search-trigger]:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });

  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Retry" }).click();
  await expect(dialog.getByRole("option").first()).toBeVisible();
  expect(requests).toBe(2);
});

test("[성공] 기록 및 동일 페이지에 대한 기본 링크를 사용함", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Series" }).first().click();
  await expect(page).toHaveURL(/\/en\/series$/u);
  await expect(
    page.getByRole("link", { name: /Building from First Principles/u }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/en$/u);

  await page.goto("/en/docs/fe/nextjs-16");
  const hashLink = page.locator('a[href^="#"]:visible').first();
  const hash = await hashLink.getAttribute("href");
  await hashLink.click();
  await expect(page).toHaveURL(new RegExp(`${hash}$`, "u"));
});

test("[성공] 쇼케이스에서 두 애니메이션 제작 모델을 비교함", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Showcase" }).first().click();
  await expect(page).toHaveURL(/\/en\/showcase$/u);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Showcase");
  await expect(page.locator('[data-showcase="theatre"]')).toBeVisible();
  await expect(page.locator('[data-showcase="motion-canvas"]')).toBeVisible();

  const progress = page.getByRole("slider", { name: "Animation progress" });
  await progress.fill("700");
  await expect(progress).toHaveValue("700");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page);
});

test("[성공] 모바일 문서 경로를 다시 방문해도 검색 상태를 초기화함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/docs/fe/nextjs-16");
  const trigger = page.getByRole("button", { name: "Search documentation" });
  await trigger.click();
  const search = page.getByRole("dialog", { name: "Search documentation" });
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();

  await page.getByRole("link", { name: "한국어로 읽기" }).click();
  await expect(page).toHaveURL(/\/ko\/docs\/fe\/nextjs-16$/u);

  await page.goBack();
  await expect(page).toHaveURL(/\/en\/docs\/fe\/nextjs-16$/u);
  await expect(search).toBeHidden();
});

test("[성공] 각주를 미리 보고 참조와 본문 사이를 이동함", async ({ page }) => {
  await page.goto("/en/the-expensive-main-thread");

  const references = page.locator("[data-footnote-ref]");
  const reference = references.first();
  const preview = page.locator('[data-footnote-preview="true"]');

  await reference.focus();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(
    "The compositor thread is responsible for compositing",
  );
  await expect(preview.locator("[data-footnote-backref]")).toHaveCount(0);
  await expect(preview.locator("[id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page, '[data-footnote-preview="true"]');
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(reference).toBeFocused();

  await reference.evaluate((element) => element.blur());
  await page.mouse.move(0, 0);
  await reference.hover();
  await expect(preview).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(preview).toBeHidden();
  await reference.focus();
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(reference).toBeFocused();

  const sourceReference = references.nth(1);
  await sourceReference.focus();
  await expect(preview).toBeVisible();
  const sourceLink = preview.getByRole("link", {
    name: "https://web.dev/articles/rendering-performance",
  });
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
  await page.keyboard.press("Tab");
  await expect(sourceLink).toBeFocused();
  await page.keyboard.press("Escape");

  const footnote = page.locator("#user-content-fn-1");
  await reference.click();

  await expect(page).toHaveURL(/#user-content-fn-1$/u);
  await expect(footnote).toBeInViewport();

  await footnote.locator("[data-footnote-backref]").click();
  await expect(page).toHaveURL(/#user-content-fnref-1$/u);
  await expect(reference).toBeInViewport();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/the-expensive-main-thread");
  const mobileReference = page.locator("[data-footnote-ref]").first();
  await expect(preview).toBeHidden();
  await mobileReference.click();
  await expect(page).toHaveURL(/#user-content-fn-1$/u);
  await expect(page.locator("#user-content-fn-1")).toBeInViewport();
});

test("[성공] 버퍼를 로드하고 기술 검색 파일을 게시함", async ({
  page,
  siteRequest,
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
    expect((await siteRequest.get(path)).ok(), path).toBe(true);
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
