import { expect, test } from "../e2e-fixtures";

test("JavaScript 로딩 전에 초점을 받은 각주도 미리보기와 Escape를 지원함", async ({
  page,
}) => {
  let releaseScripts = () => {};
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });

  try {
    await page.goto("/en/the-expensive-main-thread", { waitUntil: "commit" });
    const reference = page.locator("[data-footnote-ref]").first();
    await reference.focus();
    await expect(reference).toBeFocused();
    releaseScripts();

    const preview = page.locator('[data-footnote-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(
      "The compositor thread is responsible for compositing",
    );
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await expect(reference).toBeFocused();

    await reference.click();
    await expect(page).toHaveURL(/#user-content-fn-1$/u);
    await expect(page.locator("#user-content-fn-1")).toBeInViewport();
  } finally {
    releaseScripts();
  }
});

for (const path of ["/notes/reading-the-13f-difference", "/sources/book"]) {
  test(`Invest 언어 전환이 현재 경로를 유지함: ${path}`, async ({
    page,
  }, testInfo) => {
    const url = new URL(`/ko${path}`, testInfo.project.use.baseURL);
    url.hostname = "invest.jamie.localhost";
    await page.goto(url.href);

    const english = page.getByRole("link", { name: "Read in English" });
    await expect(english).toHaveAttribute("href", `/en${path}`);
    await english.click();
    await expect(page).toHaveURL(new URL(`/en${path}`, url).href);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("link", { name: "한국어로 읽기" }),
    ).toHaveAttribute("href", `/ko${path}`);

    await page.getByRole("link", { name: "한국어로 읽기" }).click();
    await expect(page).toHaveURL(url.href);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  });
}
