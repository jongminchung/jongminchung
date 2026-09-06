import type { Route } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

test("[성공] Tech 사이트의 핵심 콘텐츠와 접근성 계약을 제공함", async ({
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

test("[성공] 목록 제어를 URL과 동기화하고 다음 글을 자동으로 이어 붙임", async ({
  page,
}) => {
  await page.goto("/en?sort=oldest&view=list");
  const results = page.locator("[data-view=list]");
  await expect(results).toBeVisible();
  await expect(page.getByRole("link", { name: "Newest" })).toHaveAttribute(
    "href",
    /view=list/u,
  );
  await expect(page.getByRole("link", { name: "Grid" })).toHaveAttribute(
    "href",
    /sort=oldest/u,
  );
  await expect(page.getByRole("link", { name: "Load more" })).toHaveAttribute(
    "href",
    /page=2/u,
  );
  await expect(results.locator(":scope > a")).toHaveCount(9);

  const nextPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/en/articles" && url.searchParams.get("page") === "2"
    );
  });
  await page
    .locator('[data-infinite-scroll-sentinel="true"]')
    .scrollIntoViewIfNeeded();
  const nextBatch = await nextPageResponse;
  const payload = (await nextBatch.json()) as { items: { href: string }[] };
  expect(payload.items).toHaveLength(9);
  const firstPageHrefs = await results
    .locator(":scope > a")
    .evaluateAll((links) =>
      links.slice(0, 9).map((link) => link.getAttribute("href")),
    );
  expect(
    payload.items.every((item) => !firstPageHrefs.includes(item.href)),
  ).toBe(true);
  await expect.poll(() => results.locator(":scope > a").count()).toBe(18);
  await expect(page).toHaveURL(/page=2/u);
  await expect(
    page.getByRole("link", { name: "Grid", exact: true }),
  ).toHaveAttribute("href", /page=2/u);

  await results.locator(":scope > a").first().click();
  await expect(
    page.getByRole("button", { name: "Copy article", exact: true }),
  ).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/page=2/u);
  await expect(page.locator("[data-view=list]:visible > a")).toHaveCount(18);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-view=list] > a")).toHaveCount(18);
});

test("[성공] 다음 글 응답이 진행 중인 페이지 탐색을 취소하지 않음", async ({
  page,
  siteRequest,
}) => {
  const articles = Promise.withResolvers<Route>();
  const showcase = Promise.withResolvers<void>();
  const releaseShowcase = Promise.withResolvers<void>();
  await page.route("**/en/articles?*", (route) => articles.resolve(route));
  await page.route("**/en/showcase?*", async (route) => {
    showcase.resolve();
    await releaseShowcase.promise;
    await route.continue();
  });
  await page.goto("/en");
  const articlesRoute = await articles.promise;
  await page
    .getByRole("link", { name: "Showcase", exact: true })
    .first()
    .click();
  await showcase.promise;

  // 목적지 응답을 보류한 동안 목록 응답부터 완료하여 탐색 충돌을 재현함.
  const articleResponse = page.waitForResponse("**/en/articles?*");
  await articlesRoute.fulfill({
    response: await siteRequest.get("/en/articles?page=2"),
  });
  await articleResponse;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  releaseShowcase.resolve();
  await expect(page).toHaveURL(/\/en\/showcase$/u);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Showcase");
  await page.goBack();
  await expect(page).toHaveURL(/\/en\?page=2$/u);
  await expect(page.locator('[data-view="grid"]:visible > a')).toHaveCount(18);
  await page.goForward();
  await expect(page).toHaveURL(/\/en\/showcase$/u);
});

test.describe("JavaScript가 비활성화된 환경", () => {
  test.use({ javaScriptEnabled: false });

  test("태그 패널을 키보드로 열고 모든 후순위 태그를 탐색함", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const tagBrowser = page.locator('[data-editorial-tag-browser="true"]');
    const summary = tagBrowser.locator("summary");
    const label = await summary.textContent();
    const remainingTagCount = Number(label?.match(/\d+/u)?.[0]);

    expect(remainingTagCount).toBeGreaterThan(0);
    await expect(summary).toContainText(`Browse tags · ${remainingTagCount}`);
    await summary.focus();
    await summary.press("Enter");
    await expect(tagBrowser).toHaveAttribute("open", "");
    await expect(
      tagBrowser.locator('[data-editorial-tag-panel="true"] a'),
    ).toHaveCount(remainingTagCount);
  });

  test("[성공] 다음 페이지 링크로 이후 글을 계속 탐색함", async ({ page }) => {
    await page.goto("/en?sort=oldest&view=list", {
      waitUntil: "domcontentloaded",
    });

    const results = page.locator("[data-view=list]");
    await expect(results.locator(":scope > a")).toHaveCount(9);

    const nextPage = page.getByRole("link", { name: "Load more" });
    await expect(nextPage).toHaveAttribute("href", /page=2/u);
    const nextPageHref = await nextPage.getAttribute("href");
    if (nextPageHref === null) throw new Error("Next page link has no href");
    await page.goto(nextPageHref, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/page=2/u);
    await expect(page.locator("[data-view=list] > a")).toHaveCount(18);
  });
});

test("[성공] 생성된 검색 색인으로 문서를 찾고 번역 문서로 이동함", async ({
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
  let shouldFail = true;
  await page.route("**/en/search*", async (route) => {
    requests += 1;
    if (shouldFail) await route.fulfill({ status: 503, body: "unavailable" });
    else await route.continue();
  });
  await page.goto("/en");
  await page.locator("[data-docs-search-trigger]:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });

  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 30_000 });
  shouldFail = false;
  await dialog.getByRole("button", { name: "Retry" }).click();
  await expect(dialog.getByRole("option").first()).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
});

test("[성공] 알 수 없는 검색 문서 유형에도 결과와 이동을 유지함", async ({
  page,
}) => {
  await page.route("**/en/search*", (route) =>
    route.fulfill({
      json: [
        {
          id: "future-document",
          type: "page",
          url: "/en/docs/fe/nextjs-16",
          content: "Future document",
          breadcrumbs: ["future-kind", "Frontend"],
        },
      ],
    }),
  );
  await page.goto("/en");
  await page.locator("[data-docs-search-trigger]:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  const result = dialog.getByRole("option", { name: /Future document/u });
  await expect(result).toContainText("Docs");
  await expect(result).toContainText("Frontend");
  await result.click();
  await expect(page).toHaveURL(/\/en\/docs\/fe\/nextjs-16$/u);
  await expect(dialog).toBeHidden();
});

test("[성공] 문서 CSS를 탐색 시 로드하고 목록 복귀 시 shell 스타일을 유지함", async ({
  page,
}) => {
  const stylesheets: string[] = [];
  const styles = new Set<Promise<void>>();
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".css")) {
      styles.add(
        response.text().then((css) => {
          stylesheets.push(css);
        }),
      );
    }
  });
  // 지연 이미지·백그라운드 요청 대신 문서 load와 필요한 CSS 응답만 기다림.
  await page.goto("/en");
  await Promise.all(styles);
  expect(stylesheets.some((css) => css.includes(".shiki"))).toBe(false);
  expect(
    stylesheets.some((css) => css.includes("@keyframes showcase-motion-token")),
  ).toBe(false);
  const header = page.locator("header").first();
  const shellStyle = await header.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: style.height,
      position: style.position,
      background: style.backgroundColor,
    };
  });
  // 현재 viewport에서는 다음 페이지를 미리 읽음. 복귀 시 로딩된 범위를 유지해야 함.
  await expect(page).toHaveURL(/\/en\?page=2$/u);
  const listingUrl = page.url();
  // 검색 결과를 통한 App Router 전환에서도 문서 전용 CSS가 따라와야 함.
  await page.route("**/en/search*", (route) =>
    route.fulfill({
      json: [
        {
          id: "docs",
          type: "page",
          url: "/en/docs/fe/nextjs-16",
          content: "Next.js 16",
          breadcrumbs: ["reference", "Frontend"],
        },
      ],
    }),
  );
  await page.locator("[data-docs-search-trigger]:visible").first().click();
  await page.getByRole("option", { name: /Next.js 16/u }).click();
  await expect(page).toHaveURL(/\/en\/docs\/fe\/nextjs-16$/u);
  await expect(page.locator("#nd-docs-layout")).toHaveCSS("display", "grid");
  await expect(page.locator("[data-docs-code-block]").first()).toBeVisible();
  await expect
    .poll(() => stylesheets.some((css) => css.includes(".shiki")))
    .toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(listingUrl);
  await expect(page.locator('[data-view="grid"]:visible > a')).toHaveCount(18);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Engineering",
  );
  expect(
    await header.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: style.height,
        position: style.position,
        background: style.backgroundColor,
      };
    }),
  ).toEqual(shellStyle);
  await expectNoHorizontalOverflow(page);
});

test("[성공] 브라우저 기록과 문서 내부 링크로 이동함", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en\?page=2$/u);
  const listingUrl = page.url();
  await page.getByRole("link", { name: "Series" }).first().click();
  await expect(page).toHaveURL(/\/en\/series$/u);
  await expect(
    page.getByRole("link", { name: /Building from First Principles/u }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(listingUrl);
  await expect(page.locator('[data-view="grid"]:visible > a')).toHaveCount(18);

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

  await page.getByRole("button", { name: "Engineering content menu" }).click();
  await page
    .getByRole("dialog", { name: "Engineering content menu" })
    .getByRole("link", { name: "한국어로 읽기" })
    .click();
  await expect(page).toHaveURL(/\/ko\/docs\/fe\/nextjs-16$/u);

  await page.goBack();
  await expect(page).toHaveURL(/\/en\/docs\/fe\/nextjs-16$/u);
  await expect(search).toBeHidden();
});

test("[성공] 모바일 블로그에서 전체 탐색과 글 목차를 유지함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ko/building-coding-agent", {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "기술 콘텐츠 메뉴" }).click();
  const menu = page.getByRole("dialog", { name: "기술 콘텐츠 메뉴" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Blog" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Series" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Showcase" })).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Docs", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  const toc = page.locator('[data-mobile-toc="editorial"]');
  await expect(toc).toBeVisible();
  await toc.getByText("이 글에서", { exact: true }).click();
  await expect(
    toc.getByRole("link", { name: "에이전트란 무엇인가" }),
  ).toBeVisible();
  await expect(toc.getByRole("link", { name: "맨 위로" })).toHaveAttribute(
    "href",
    "#top",
  );
});

test("[성공] 한글 글의 줄바꿈·날짜·복사·터치 영역을 현지화함", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ko/building-coding-agent", {
    waitUntil: "domcontentloaded",
  });

  const title = page.getByRole("heading", {
    level: 1,
    name: "코딩 에이전트 만들어보기",
  });
  await expect(title).toHaveCSS("word-break", "keep-all");
  await expect(page.locator("[data-copy-description]")).toHaveCSS(
    "word-break",
    "keep-all",
  );
  await expect(page.locator("time").first()).toHaveText("2026. 7. 10.");

  const copy = page.getByRole("button", { name: "본문 복사" });
  await copy.click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("코딩 에이전트 만들어보기");
  expect(clipboard).toContain("터미널에 claude나 codex를 치고");

  for (const control of [
    page.getByRole("button", { name: "기술 콘텐츠 메뉴" }),
    page.getByRole("button", { name: "문서 검색" }),
    page.getByRole("button", { name: /^테마:/u }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page, "header");
  await page.getByRole("button", { name: "기술 콘텐츠 메뉴" }).click();
  const language = page
    .getByRole("dialog")
    .getByRole("link", { name: "Read in English" });
  expect((await language.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expectNoAccessibilityViolations(page, '[data-mobile-toc="editorial"]');
});

test("[성공] 각주를 미리 보고 참조와 본문 사이를 이동함", async ({ page }) => {
  await page.goto("/en/the-expensive-main-thread");

  const backToTop = page.getByRole("link", { name: "Back to top" });
  await expect(backToTop).toHaveAttribute("href", "#top");

  const references = page.locator("[data-footnote-ref]");
  const reference = references.first();
  const preview = page.locator('[data-footnote-preview="true"]');

  await reference.focus();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("aria-label", "Footnote preview");
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

test("[성공] 개별 글에서 페이지 맨 위로 이동함", async ({ page }) => {
  await page.goto("/en/the-expensive-main-thread");

  await page
    .getByRole("heading", { name: "Using the Expensive Resource Wisely" })
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await page.getByRole("link", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("[성공] 다이어그램과 검색 엔진용 자산을 제공함", async ({
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

test("[성공] 코드블록 타이포그래피 리듬을 일관되게 보장함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ko/docs/k8s/cilium-gateway-api-foundations");

  const viewports = page.locator(
    '[data-docs-code-block="true"] [role="region"]',
  );
  await expect(viewports.first()).toBeVisible();
  await expect
    .poll(() =>
      viewports.evaluateAll((elements) => {
        return elements.map((element) => {
          const style = getComputedStyle(element);
          return {
            fontSize: style.fontSize,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
          };
        });
      }),
    )
    .toEqual(
      Array.from({ length: await viewports.count() }, () => ({
        fontSize: "13px",
        letterSpacing: "normal",
        lineHeight: "20.8px",
      })),
    );
  await expectNoHorizontalOverflow(page);
});

test("[성공] 선택한 Tech 로캘을 쿠키에 저장함", async ({ page }) => {
  await page.goto("/ko");
  expect(
    (await page.context().cookies()).find(({ name }) => name === "tech-locale")
      ?.value,
  ).toBe("ko");
});

test("[성공] 저장된 Tech 테마를 복원하고 변경함", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tech-theme", "dark"));
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const editorialImage = page
    .locator('img[data-editorial-image="true"]:visible')
    .first();
  await expect(editorialImage).toHaveAttribute("src", /\.png/u);
  const imageSrc = await editorialImage.getAttribute("src");
  const themeControl = page.getByRole("button", { name: "Theme: dark" });
  await expect(themeControl).toBeVisible();
  await themeControl.click();
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("tech-theme")))
    .toBe("system");
  await expect(editorialImage).toHaveAttribute("src", imageSrc ?? "");
});

test("[성공] 글 사이를 이동한 뒤 현재 글만 복사함", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/ko/building-coding-agent");
  const oldTitle = await page.getByRole("heading", { level: 1 }).innerText();
  const nextArticle = page
    .getByRole("navigation", { name: "이전 및 다음 문서", exact: true })
    .getByRole("link")
    .first();
  const href = await nextArticle.getAttribute("href");
  if (href === null) throw new Error("Article link has no href");
  await nextArticle.click();
  await expect(page).toHaveURL(href);
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  expect(title).not.toBe(oldTitle);
  await page.getByRole("button", { name: "본문 복사", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "복사됨", exact: true }),
  ).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.startsWith(title)).toBe(true);
  const body = await page.locator("[data-copy-article]:visible").innerText();
  expect(clipboard).toContain(body.trim());
});

test("[성공] 다음 글 요청 실패 시 링크로 탐색을 계속함", async ({ page }) => {
  await page.route("**/en/articles?**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/en?sort=oldest&view=list");
  const failedResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/en/articles?") && response.status() === 503,
  );
  await page
    .locator('[data-infinite-scroll-sentinel="true"]')
    .scrollIntoViewIfNeeded();
  await failedResponse;
  const more = page.getByRole("link", { name: "Load more" });
  await expect(more).toHaveAttribute("aria-disabled", "false");
  await more.click();
  await expect(page).toHaveURL(/page=2/u);
  await expect(page.locator("[data-view=list]:visible > a")).toHaveCount(18);
});

test("[성공] 추가 글 API는 locale과 페이지 범위를 지킴", async ({
  siteRequest,
}) => {
  const first = await siteRequest.get("/en/articles?sort=oldest&page=1");
  const second = await siteRequest.get("/en/articles?sort=oldest&page=2");
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  const firstPage = (await first.json()) as {
    items: { id: string; href: string }[];
  };
  const secondPage = (await second.json()) as {
    items: { id: string; href: string }[];
    page: number;
  };
  expect(firstPage.items).toHaveLength(9);
  expect(secondPage.items).toHaveLength(9);
  expect(secondPage.page).toBe(2);
  const firstIds = new Set(firstPage.items.map((item) => item.id));
  expect(
    secondPage.items.every(
      (item) => !firstIds.has(item.id) && item.href.startsWith("/en/"),
    ),
  ).toBe(true);
  expect((await siteRequest.get("/fr/articles")).status()).toBe(404);
});
