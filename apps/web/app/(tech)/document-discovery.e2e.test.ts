import { expect, test } from "../../e2e-fixtures";

test("[성공] 시리즈 랜딩은 등록 순서와 언어 전환 경로를 유지함", async ({
  page,
}) => {
  await page.goto("/ko/series/cilium-gateway-api");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cilium Gateway API 외부 트래픽 설계",
    }),
  ).toBeVisible();
  const cards = page.locator('[data-document-grid="true"]');
  await expect(cards).toBeVisible();
  const latest = cards.locator('a[data-variant="related"]').first();
  await expect(latest).toHaveAttribute(
    "href",
    "/ko/cilium-gateway-api-foundations",
  );
  await expect(latest.locator("img")).toHaveAttribute(
    "src",
    /_next\/image\?url=%2Ftech%2Farticle-thumbnail-system\.png/u,
  );
  await expect
    .poll(() =>
      latest.locator("img").evaluate((element) => {
        const image = element as HTMLImageElement;
        return {
          naturalHeight: image.naturalHeight,
          naturalWidth: image.naturalWidth,
        };
      }),
    )
    .toEqual({ naturalHeight: 675, naturalWidth: 1200 });

  const globalNavigation = page.getByRole("navigation", {
    name: "Editorial navigation",
  });
  await expect(
    globalNavigation.getByRole("link", { name: "시리즈" }),
  ).toHaveAttribute("href", "/ko/series");
  await expect(
    page.getByRole("link", { name: "Read in English" }),
  ).toHaveAttribute("href", "/en/series/cilium-gateway-api");
});

test("[성공] 문서 개요 링크는 현재 위치와 URL hash를 함께 갱신함", async ({
  page,
}) => {
  await page.goto("/en/nextjs-16");
  const outline = page.getByRole("navigation", { name: "Document outline" });
  const link = outline.getByRole("link", { name: "MDX pipeline" });
  await link.click();
  await expect(page).toHaveURL(/#mdx-pipeline$/u);
  await expect(link).toHaveAttribute("aria-current", "location");
});

test("[성공] 관련 문서는 결정적이며 현재 문서를 제외함", async ({ page }) => {
  await page.goto("/en/typescript-6");
  const related = page.getByRole("region", { name: "Related articles" });
  await expect(related).toBeVisible();
  await expect(related.locator("a")).toHaveCount(3);
  expect(
    await related
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual([
    "/en/typescript-7-compatibility",
    "/en/node-26",
    "/en/building-calculator-engine",
  ]);
  await expect(related.locator('a[href="/en/typescript-6"]')).toHaveCount(0);
});

test("[성공] FE 유지보수 시리즈는 문서 유형과 MDX 접근성 계약을 노출함", async ({
  page,
}) => {
  await page.goto("/ko?tag=tutorial");
  await expect(
    page.getByRole("navigation", { name: "모든 글" }).getByRole("link", {
      name: "튜토리얼 1",
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("모든 글 / 01")).toBeVisible();

  await page.goto("/ko/series/frontend-maintainability");

  const cards = page.locator('[data-document-grid="true"]');
  await expect(cards.locator('a[data-variant="related"]')).toHaveCount(4);
  await expect(cards.locator('a[data-variant="related"]')).toContainText([
    "1. 설명",
    "2. 튜토리얼",
    "3. 방법 안내",
    "4. 기술 참조",
  ]);
  await expect(
    page.getByRole("link", { name: "Read in English" }),
  ).toHaveAttribute("href", "/en/series/frontend-maintainability");

  await page.goto("/ko/tutorial-maintainable-tailwind-shadcn");
  const steps = page.locator('[data-docs-steps="true"]');
  await expect(steps).toHaveRole("list");
  await expect(steps.locator(":scope > li")).toHaveCount(5);
  await expect(page.getByRole("note", { name: "학습 결과" })).toBeVisible();
  await expect(page.getByRole("link", { name: "근거 자료" })).toHaveAttribute(
    "href",
    "https://news.hada.io/topic?id=32073",
  );

  await page.goto("/ko/why-tailwind-shadcn-maintainability-needs-ownership");
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

test("[성공] OG 이미지 및 llms.txt는 정적 검색 자산과 함께", async ({
  page,
  siteRequest,
}) => {
  await page.goto("/en/typescript-7-compatibility");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://tech.jamie.kr/og/en/typescript-7-compatibility",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  const image = await siteRequest.get(
    "/og/ko/server-monitoring-analysis-guide",
  );
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect([...(await image.body()).subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const llms = await siteRequest.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(llms.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(await llms.text()).toContain(
    "[TypeScript 7 Compatibility Verification](https://tech.jamie.kr/en/typescript-7-compatibility)",
  );
});
