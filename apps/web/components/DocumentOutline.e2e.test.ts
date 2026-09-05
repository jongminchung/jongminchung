import { expect, test } from "../e2e-fixtures";

const cases = [
  { site: "tech", path: "/en/server-monitoring-analysis-guide" },
  { site: "invest", path: "/en/notes/reading-the-13f-difference" },
] as const;

for (const { site, path } of cases) {
  test(`${site}: 목차의 강조와 접근성 상태가 클릭·스크롤·뒤로 가기에서 일치함`, async ({
    page,
  }, testInfo) => {
    const url = new URL(path, testInfo.project.use.baseURL);
    url.hostname = `${site}.jamie.localhost`;
    await page.goto(url.href);

    const outline = page.getByRole("navigation", { name: "Document outline" });
    const links = outline.getByRole("link");
    const active = outline.locator('a[data-active="true"]');
    const first = links.nth(0);
    const second = links.nth(1);
    const firstHref = await first.getAttribute("href");
    const secondHref = await second.getAttribute("href");
    if (firstHref === null || secondHref === null)
      throw new Error("Article outline requires two heading links.");

    await first.click();
    await expect(page).toHaveURL(new URL(firstHref, url).href);
    await expect(first).toHaveAttribute("data-active", "true");
    await expect(first).toHaveAttribute("aria-current", "location");

    // 스크롤은 URL hash를 바꾸지 않아도 현재 읽는 제목을 갱신해야 한다.
    await page
      .locator(secondHref)
      .evaluate((heading) =>
        heading.scrollIntoView({ behavior: "instant", block: "start" }),
      );
    // 한 화면에 여러 제목이 보일 수 있으므로 기존 Fumadocs 강조와의 일치를 검사한다.
    await expect(first).toHaveAttribute("data-active", "false");
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("aria-current", "location");
    await expect(first).not.toHaveAttribute("aria-current", "location");
    await expect(page).toHaveURL(new URL(firstHref, url).href);

    await second.click();
    await expect(page).toHaveURL(new URL(secondHref, url).href);
    await page.goBack();
    await expect(page).toHaveURL(new URL(firstHref, url).href);
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("aria-current", "location");

    await page.reload();
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("aria-current", "location");
  });
}
