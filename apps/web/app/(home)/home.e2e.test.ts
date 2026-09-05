import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

test("[성공] Home의 핵심 작업과 공유 메타데이터를 제공함", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Jamie — Jongmin Chung");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('[data-project="true"]').first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.jamie.kr/en",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/og$/u,
  );
  await expect(
    page.locator("header").getByRole("link", { name: "jongminchung home" }),
  ).toContainText("jongminchung");
});

for (const locale of ["ko", "en"] as const) {
  test(`${locale}: Home에서 Tech·Invest와 최근 기록을 바로 탐색함`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}`);
    const navigation = page.getByRole("navigation", {
      name: locale === "ko" ? "주요 탐색" : "Primary navigation",
    });
    for (const site of ["tech", "invest"] as const) {
      const label = site === "tech" ? "Tech" : "Invest";
      const link = navigation.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute(
        "href",
        `https://${site}.jamie.kr/${locale}`,
      );
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator(`[data-home-site="${site}"]`)).toHaveAttribute(
        "href",
        `https://${site}.jamie.kr/${locale}`,
      );
    }
    const latest = page.getByRole("link", {
      name: locale === "ko" ? "최근 기록 읽기" : "Read the latest",
      exact: true,
    });
    await latest.click();
    await expect(page).toHaveURL(/#writing$/u);
    await expect(page.locator("#writing-title")).toBeInViewport();
    const articles = page.locator("#writing li a");
    expect(await articles.count()).toBeGreaterThan(0);
    for (const link of await articles.all()) {
      await expect(link).toHaveAttribute(
        "href",
        new RegExp(`^https://(?:tech|invest)\\.jamie\\.kr/${locale}/`),
      );
    }
    await expectNoHorizontalOverflow(page);
  });
}

test("키보드와 JavaScript 없는 환경에서도 목적지와 언어를 탐색함", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("http://jamie.localhost:3100/en");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/u);
    await page.getByRole("link", { name: "한국어로 읽기" }).click();
    await expect(page).toHaveURL(/\/ko$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator('[data-home-site="tech"]')).toHaveAttribute(
      "href",
      "https://tech.jamie.kr/ko",
    );
  } finally {
    await context.close();
  }
});

test("[성공] 검색과 공유에 필요한 정적 자산을 제공함", async ({
  page,
  siteRequest,
}) => {
  await page.goto("/en");
  const socialImageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(socialImageUrl).not.toBeNull();
  const [favicon, robots, sitemap, socialImage] = await Promise.all([
    siteRequest.get("/icon.svg"),
    siteRequest.get("/robots.txt"),
    siteRequest.get("/sitemap.xml"),
    siteRequest.get(
      new URL(socialImageUrl ?? "", "https://www.jamie.kr").pathname,
    ),
  ]);

  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<text");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("https://www.jamie.kr/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://www.jamie.kr");
  expect(socialImage.ok()).toBe(true);
  expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("[성공] 자동 검사 가능한 접근성 위반이 없음", async ({ page }) => {
  await page.goto("/");
  await expectNoAccessibilityViolations(page);
});

test("[성공] 모바일에서 수평 overflow 없이 탐색할 수 있음", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});

for (const [savedMode, nextMode] of [
  ["system", "light"],
  ["light", "dark"],
  ["dark", "system"],
] as const) {
  test(`${savedMode}: 저장된 Home 테마를 오류 없이 복원하고 변경함`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(
      (mode) => localStorage.setItem("home-theme", mode),
      savedMode,
    );
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      savedMode === "system" ? "light" : savedMode,
    );
    await page.getByRole("button", { name: `Theme: ${savedMode}` }).click();
    await expect(
      page.getByRole("button", { name: `Theme: ${nextMode}` }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("home-theme")))
      .toBe(nextMode);
    expect(errors).toEqual([]);
  });
}

test("[성공] 시스템 모드일 때 운영체제의 다크 설정을 따름", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("home-theme", "system"));
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("[성공] 영문 UI subset을 자체 호스팅 자산에서 불러옴", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(request.url());
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  expect(
    fontRequests.some(
      (url) => new URL(url).pathname === "/fonts/pretendard-latin.woff2",
    ),
  ).toBe(true);
  const pageOrigin = new URL(page.url()).origin;
  expect(fontRequests.every((url) => new URL(url).origin === pageOrigin)).toBe(
    true,
  );
});
