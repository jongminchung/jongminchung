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
    "Investment research with source and judgment",
  );
  await expect(
    page.getByRole("link", {
      name: "Efficiency compounds when the feedback loop is owned end to end",
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page);
});

test("[성공] 관계자 투자 관찰 파일을 게시함", async ({ siteRequest }) => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/en/rss.xml"]) {
    const response = await siteRequest.get(path);
    expect(response.ok(), path).toBe(true);
  }
});

test("[성공] 투자 장소를 선택하고 기억함", async ({ page }) => {
  await page.goto("/ko");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "출처와 판단",
  );
  expect(
    (await page.context().cookies()).find(
      ({ name }) => name === "invest-locale",
    )?.value,
  ).toBe("ko");
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
