import { expect, test } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";

for (const [locale, mode, theme, width, forcedColors] of [
  ["ko", "docs", "light", 390, "none"],
  ["ko", "article", "dark", 390, "none"],
  ["en", "docs", "light", 1280, "none"],
  ["en", "article", "dark", 1280, "none"],
  ["ko", "docs", "dark", 390, "active"],
] as const) {
  test(`실제 MDX 읽기 도구 ${locale}/${mode}/${theme}/${forcedColors}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ forcedColors });
    await page.addInitScript(
      (value) => localStorage.setItem("tech-theme", value),
      theme,
    );
    await page.goto(`/fixtures/reading-tools?locale=${locale}&mode=${mode}`);
    const details = page.locator("details");
    await expect(details).not.toHaveAttribute("open");
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await details.getByRole("link").click();
    await expect(page).toHaveURL(/#showcase-(ko|en)-glossary-idempotency$/u);
    await expect(
      page.locator('dt[id$="-glossary-idempotency"]'),
    ).toBeInViewport();
    await expect(page.locator(".line.highlighted")).toHaveCount(1);
    await expect(page.locator("[data-line-numbers]").first()).toBeVisible();
    const groups = page.getByRole("group", {
      name:
        locale === "ko"
          ? /^(변경 전|변경 후|예제:|반례:)/u
          : /^(Before|After|Example|Counterexample)$/u,
    });
    await expect(groups).toHaveCount(4);
    const first = await groups.nth(0).boundingBox();
    const second = await groups.nth(1).boundingBox();
    if (!first || !second) throw new Error("Missing comparison panels");
    if (width < 768) expect(second.y).toBeGreaterThan(first.y);
    else expect(Math.abs(second.y - first.y)).toBeLessThan(1);
    await expectNoHorizontalOverflow(page);
    await expectNoAccessibilityViolations(page, "main");
    await details.locator("summary").focus();
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("reading-tools.png"),
      fullPage: true,
    });
  });
}

test.describe("JavaScript 없는 읽기", () => {
  test.use({ javaScriptEnabled: false });
  test("native details와 용어 정의 링크가 동작함", async ({ page }) => {
    await page.goto("/fixtures/reading-tools?locale=ko");
    const details = page.locator("details");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await details.getByRole("link").click();
    await expect(page).toHaveURL(/#showcase-(ko|en)-glossary-idempotency$/u);
    await expect(
      page.locator('dt[id$="-glossary-idempotency"]'),
    ).toBeInViewport();
  });
});
