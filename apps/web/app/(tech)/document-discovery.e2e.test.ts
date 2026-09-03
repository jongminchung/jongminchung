import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

test("[성공] 이전 Blog·Series·태그 기반 Docs URL은 최종 canonical로 한 번만 308 이동함", async ({
  siteRequest,
}) => {
  const redirects = [
    ["/en/nextjs-16", "/en/docs/fe/nextjs-16"],
    ["/en/series/domain-driven-design", "/en/docs/be/domain-driven-design"],
    ["/en/docs/architecture/ascii-3d-renderer", "/en/ascii-3d-renderer"],
    ["/en/docs/architecture", "/en/docs/be"],
    ["/en/docs/tooling/typescript-6", "/en/docs/fe/typescript-6"],
    ["/en/docs/tooling", "/en/docs/fe"],
    ["/en/docs/practices/collaboration", "/en/docs/be/collaboration"],
    ["/en/docs/practices", "/en/docs/be"],
    [
      "/en/series/distributed-failure-handling",
      "/en/docs/be/distributed-failure-handling",
    ],
    [
      "/en/series/frontend-maintainability",
      "/en/docs/fe/frontend-maintainability",
    ],
    ["/en/series/cilium-gateway-api", "/en/docs/k8s/cilium-gateway-api"],
  ] as const;

  for (const [source, target] of redirects) {
    const response = await siteRequest.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    expect(
      new Set((response.headers().location ?? "").split(", ")),
      source,
    ).toEqual(new Set([target]));
    expect((await siteRequest.get(target)).status(), target).toBe(200);
  }
});

test("[성공] Docs canonical은 TechArticle·학습 유형·breadcrumb·TOC를 제공함", async ({
  page,
}) => {
  await page.goto("/en/docs/fe/nextjs-16");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://tech.jamie.kr/en/docs/fe/nextjs-16",
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", "https://tech.jamie.kr/en/docs/fe/nextjs-16");

  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map((script) => JSON.parse(script.textContent ?? "{}") as object),
    );
  expect(JSON.stringify(schemas)).toContain('"@type":"TechArticle"');
  expect(JSON.stringify(schemas)).toContain(
    '"learningResourceType":"reference"',
  );
  expect(JSON.stringify(schemas)).toContain('"name":"Frontend"');

  const outline = page.locator("#nd-toc");
  await expect(outline).toContainText("On this page");
  const link = outline.getByRole("link", { name: "MDX pipeline" });
  await link.click();
  await expect(page).toHaveURL(/#mdx-pipeline$/u);
});

test("[성공] Blog는 주제 이미지와 주장·반론으로 시작하고 Docs는 사실 문서 구조를 유지함", async ({
  page,
}) => {
  await page.goto("/ko/server-monitoring-analysis-guide");
  const hero = page.locator('[data-tech-article-hero="true"]');
  await expect(hero).toBeVisible();
  await expect(hero.locator("img:visible")).toHaveAttribute(
    "src",
    /server-monitoring-analysis-guide\.png/u,
  );
  await expect(hero.locator("img")).toHaveCount(1);
  const argument = page.locator('[data-article-argument="true"]');
  await expect(argument).toBeVisible();
  await expect(
    page.locator(
      '[data-tech-article-hero="true"] + [data-article-argument="true"]',
    ),
  ).toBeVisible();
  await expect(argument).toContainText("이 글의 주장");
  await expect(argument).toContainText("가장 강한 반론");
  await expect(argument).toContainText("가설을 반증하는 절차");

  await page.goto("/ko/docs/fe/nextjs-16");
  await expect(page.locator('[data-tech-article-hero="true"]')).toHaveCount(0);
  await expect(page.locator('[data-article-argument="true"]')).toHaveCount(0);
});

test("[성공] Blog 목록과 공유 메타데이터는 글별 주제 이미지를 사용함", async ({
  page,
}) => {
  await page.goto("/en");
  const cardImage = page.locator(
    'a[href="/en/server-monitoring-analysis-guide"] img[data-editorial-image="true"]:visible',
  );
  await expect(cardImage).toHaveAttribute(
    "src",
    /server-monitoring-analysis-guide\.png/u,
  );
  await expect(cardImage).toHaveCount(1);

  await page.goto("/en/building-calculator-engine");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://tech.jamie.kr/tech/articles/building-calculator-engine.png",
  );
  await expect(page.locator('[data-tech-article-hero="true"] img')).toHaveCount(
    1,
  );
});

test("[성공] 과거 Tech 테마 이미지 URL을 단일 이미지로 영구 이동함", async ({
  siteRequest,
}) => {
  for (const theme of ["light", "dark"] as const) {
    const response = await siteRequest.get(
      `/tech/articles/building-calculator-engine.${theme}.png`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/tech/articles/building-calculator-engine.png",
    );
  }
});

test("[성공] Series 상세는 Blog 멤버만 seriesOrder 순서로 표시함", async ({
  page,
}) => {
  await page.goto("/en/series/building-from-first-principles");
  const cards = page.locator('[data-document-grid="true"] a');
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toHaveAttribute(
    "href",
    "/en/building-calculator-engine",
  );
  await expect(cards.last()).toHaveAttribute(
    "href",
    "/en/encrypted-share-vault-system",
  );
  await expect(cards.locator('[href^="/en/docs/"]')).toHaveCount(0);

  await page.goto("/en/series/react-ui-architecture");
  await expect(page.locator('[data-document-grid="true"] a')).toHaveCount(3);
});

test("[성공] Docs page tree는 Diátaxis 순서와 현재 문서 및 이전·다음 탐색을 표시함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/docs/fe/tutorial-maintainable-tailwind-shadcn");

  const sidebar = page.locator("#nd-sidebar");
  await expect(sidebar).toBeVisible();
  const sidebarText = await sidebar.innerText();
  expect(sidebarText.indexOf("Tutorial")).toBeLessThan(
    sidebarText.indexOf("How-to"),
  );
  expect(sidebarText.indexOf("How-to")).toBeLessThan(
    sidebarText.indexOf("Reference"),
  );
  expect(sidebarText.indexOf("Reference")).toBeLessThan(
    sidebarText.indexOf("Explanation"),
  );
  await expect(
    sidebar.locator(
      'a[href="/en/docs/fe/tutorial-maintainable-tailwind-shadcn"]',
    ),
  ).toHaveAttribute("data-active", "true");
  await expect(
    page.getByRole("link", { name: "한국어로 읽기" }),
  ).toHaveAttribute(
    "href",
    "/ko/docs/fe/tutorial-maintainable-tailwind-shadcn",
  );

  await expect(
    page.locator('#nd-page > div[class*="@container"]').last(),
  ).toContainText("Frontend Documentation");
  await expect(
    page.locator(
      '#nd-page > div[class*="@container"] a[href="/en/docs/fe/how-to-audit-tailwind-shadcn"]',
    ),
  ).toBeVisible();
});

test("[성공] Tutorial과 Explanation은 이관 후에도 MDX 학습 계약과 키보드 초점을 유지함", async ({
  page,
}) => {
  await page.goto("/ko/docs/fe/tutorial-maintainable-tailwind-shadcn");
  const steps = page.locator('[data-docs-steps="true"]');
  await expect(steps).toHaveRole("list");
  await expect(steps.locator(":scope > li")).toHaveCount(5);
  await expect(page.getByRole("note", { name: "학습 결과" })).toBeVisible();
  await expect(page.getByRole("link", { name: "근거 자료" })).toHaveAttribute(
    "href",
    "https://news.hada.io/topic?id=32073",
  );

  await page.goto(
    "/ko/docs/fe/why-tailwind-shadcn-maintainability-needs-ownership",
  );
  const linkedCard = page
    .locator('[data-docs-cards="true"]')
    .getByRole("link")
    .first();
  await linkedCard.focus();
  await expect(linkedCard).toBeFocused();
  expect(
    await linkedCard.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe("none");
});

test("[성공] 플랫폼 아키텍처 시각화는 관련 Docs에서 스타일과 접근성 계약을 유지함", async ({
  page,
}) => {
  await page.goto("/en/docs/k8s/ansible-rke2-gitops-platform");

  const coverageMap = page.getByRole("figure", {
    name: "arc42 sections used to document the RKE2 and GitOps platform",
  });
  const contextMap = page.getByRole("figure", {
    name: /C4 system context showing an operator/u,
  });
  await expect(coverageMap).toBeVisible();
  await expect(contextMap).toBeVisible();
  await expect(contextMap).toHaveCSS("overflow", "hidden");
  await expect(
    contextMap.getByRole("checkbox", { name: "Pause motion" }),
  ).toBeVisible();
});

test("[성공] Docs 루트에는 sidebar가 없고 분야별 sidebar는 현재 영역만 표시함", async ({
  page,
}) => {
  await page.goto("/ko/docs");
  await expect(
    page.getByRole("heading", { level: 1, name: "Docs" }),
  ).toBeVisible();
  await expect(page.locator("#nd-sidebar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /rke2spray/u })).toBeVisible();
  await expect(page.getByRole("link", { name: /프론트엔드/u })).toBeVisible();

  await page.goto("/ko");
  const docsTrigger = page.getByRole("button", {
    name: "Docs: 문서 분야 선택",
  });
  await expect(docsTrigger).toBeVisible();
  await docsTrigger.click();
  const docsMenu = page.getByRole("menu", { name: "문서 분야 선택" });
  await expect(docsMenu).toBeVisible();
  await expect(docsMenu.locator('[role="menuitem"]')).toHaveCount(5);
  await docsMenu
    .locator('[role="menuitem"]', { hasText: "FE · 프론트엔드" })
    .click();
  await expect(page).toHaveURL(/\/ko\/docs\/fe$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "프론트엔드 문서" }),
  ).toBeVisible();
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/be"]')).toHaveCount(
    0,
  );
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/k8s"]')).toHaveCount(
    0,
  );

  await page.goto("/ko/docs/rke2spray");
  await expect(page.locator("#nd-sidebar")).toContainText("rke2spray 문서");
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/fe"]')).toHaveCount(
    0,
  );
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/k8s"]')).toHaveCount(
    0,
  );

  await page.goto("/ko/docs/be/ddd");
  await expect(page.locator("#nd-sidebar")).toContainText("백엔드");
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/fe"]')).toHaveCount(
    0,
  );
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/k8s"]')).toHaveCount(
    0,
  );

  await page.goto("/ko/docs/k8s/cilium-gateway-api");
  await expect(page.locator("#nd-sidebar")).toContainText("Kubernetes");
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/fe"]')).toHaveCount(
    0,
  );
  await expect(page.locator('#nd-sidebar a[href^="/ko/docs/be"]')).toHaveCount(
    0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ko/docs/fe/playwright-visual-regression-testing");
  await expectNoHorizontalOverflow(page);
  const openSidebar = page.getByRole("button", { name: "Open Sidebar" });
  await openSidebar.click();
  const mobileSidebar = page.locator("#nd-sidebar-mobile");
  await expect(mobileSidebar).toBeVisible();
  await expect(mobileSidebar).toContainText("프론트엔드");
  await expect(mobileSidebar).toContainText("Tutorial · 학습");
  await mobileSidebar.getByRole("button", { name: "Close Sidebar" }).click();
  await expect(mobileSidebar).toBeHidden();
  await expectNoAccessibilityViolations(page);
});

test("[성공] Blog와 Docs는 서로 다른 schema를 사용하고 RSS·sitemap·llms 계약을 분리함", async ({
  page,
  siteRequest,
}) => {
  await page.goto("/en/building-calculator-engine");
  expect(
    await page.locator('script[type="application/ld+json"]').allTextContents(),
  ).toContainEqual(expect.stringContaining('"@type":"BlogPosting"'));

  const [rss, sitemap, llms] = await Promise.all([
    siteRequest.get("/en/rss.xml"),
    siteRequest.get("/sitemap.xml"),
    siteRequest.get("/llms.txt"),
  ]);
  const rssText = await rss.text();
  const sitemapText = await sitemap.text();
  const llmsText = await llms.text();
  expect(rssText).toContain("/en/building-calculator-engine");
  expect(rssText).not.toContain("/en/docs/fe/nextjs-16");
  expect(sitemapText).toContain("/en/docs/fe/nextjs-16");
  expect(sitemapText).not.toContain("/en/nextjs-16");
  expect(sitemapText).toContain("/en/series/building-from-first-principles");
  expect(sitemapText).toContain("/en/series/react-ui-architecture");
  expect(sitemapText).not.toContain("/en/series/domain-driven-design");
  expect(llmsText).toContain("## English Blog");
  expect(llmsText).toContain("## English Docs");
  expect(llmsText).toContain(
    "[Next.js 16](https://tech.jamie.kr/en/docs/fe/nextjs-16)",
  );
});

test("[성공] Docs OG 이미지는 canonical 경로를 사용하고 정적 이미지 자산을 제공함", async ({
  page,
  siteRequest,
}) => {
  await page.goto("/en/docs/fe/typescript-7-compatibility");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://tech.jamie.kr/og/en/docs/fe/typescript-7-compatibility",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  const image = await siteRequest.get(
    "/og/en/docs/fe/typescript-7-compatibility",
  );
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect([...(await image.body()).subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
});
