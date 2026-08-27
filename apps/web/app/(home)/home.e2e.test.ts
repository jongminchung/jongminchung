import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";
import { expect, test } from "../../e2e-fixtures";

test("[성공] 현재 상황 데이터로 Jamie의 작업을 제시함", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Jamie — Jongmin Chung");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Where should we begin?",
  );
  await expect(page.locator('[data-project="true"]').first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://jamie.kr/en",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/og$/u,
  );
  await expect(
    page.getByRole("link", { name: "jongminchung home" }),
  ).toContainText("jongminchung");
});

test("[성공] 작업 대상으로 편집 작업을 전송함", async ({ page }) => {
  await page.goto("/");

  const workAction = page.getByRole("link", { name: "Read the work" });
  const docsAction = page.getByRole("link", {
    name: "Open Engineering Notes",
  });

  await expect(workAction).toHaveAttribute("href", "#work");
  await expect(workAction).toHaveCSS("min-height", "50px");
  await expect(docsAction).toHaveAttribute("href", "https://tech.jamie.kr/en");
  await workAction.click();
  await expect(page).toHaveURL(/#work$/u);
});

test("[성공] 검색 파일 게시", async ({ page, siteRequest }) => {
  await page.goto("/en");
  const socialImageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(socialImageUrl).not.toBeNull();
  const [favicon, robots, sitemap, socialImage] = await Promise.all([
    siteRequest.get("/icon.svg"),
    siteRequest.get("/robots.txt"),
    siteRequest.get("/sitemap.xml"),
    siteRequest.get(new URL(socialImageUrl ?? "", "https://jamie.kr").pathname),
  ]);

  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<text");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("https://jamie.kr/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://jamie.kr");
  expect(socialImage.ok()).toBe(true);
  expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("[성공] 자동으로 소유할 수 있는 회원은 없습니다", async ({ page }) => {
  await page.goto("/");
  await expectNoAccessibilityViolations(page);
});

test("[성공]뷰포트 내에서 모바일 노드를 유지함", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});

test("[성공] Home 테마 선택을 적용하고 사이트별로 저장함", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("home-theme", "dark"));
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Theme: dark" }).click();
  await expect(
    page.getByRole("button", { name: "Theme: system" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("home-theme"))).toBe(
    "system",
  );
});

test("[성공] 시스템 모드일 때 운영체제의 다크 설정을 따름", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("home-theme", "system"));
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("[성공] Pretendard를 Next.js 자체 호스팅 자산에서 불러옴", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(request.url());
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  expect(fontRequests.some((url) => url.includes("/_next/static/media/"))).toBe(
    true,
  );
  const pageOrigin = new URL(page.url()).origin;
  expect(fontRequests.every((url) => new URL(url).origin === pageOrigin)).toBe(
    true,
  );
});
