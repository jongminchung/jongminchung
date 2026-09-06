import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";

for (const locale of ["ko", "en"] as const) {
  test(`${locale} MDX previews expose exact copyable author source`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/${locale}/showcase`);
    await expect(page.locator("[data-mdx-preview]")).toHaveCount(8);
    await expect(page.locator("#mdx nav a")).toHaveCount(8);
    for (const panel of await page.locator("[data-mdx-source]").all()) {
      const feature = await panel.getAttribute("data-mdx-source");
      const file = await readFile(
        new URL(
          `../../fixtures/reading/${locale}/${feature}.mdx`,
          import.meta.url,
        ),
        "utf8",
      );
      const body = file.slice(file.indexOf("---", 3) + 4);
      await expect(panel.locator("code")).toHaveText(body, {
        useInnerText: false,
      });
      expect(await panel.locator("code").textContent()).toBe(body);
      await panel.getByRole("button").click();
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(body);
      await expect(
        panel.locator("details, mark, [role=note], .highlighted"),
      ).toHaveCount(0);
    }
    await expect(
      page.locator('[data-mdx-preview="alerts"] [role="note"]'),
    ).toHaveCount(5);
    await expect(
      page.locator('[data-mdx-preview="code"] .line.highlighted'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-mdx-preview="comparison"] .line.diff'),
    ).toHaveCount(2);
    const details = page.locator("#mdx details");
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await details.getByRole("link").click();
    await expect(
      page.locator(`dt#showcase-${locale}-glossary-idempotency`),
    ).toBeInViewport();
    await details.locator("summary").focus();
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open");
    const ids = await page
      .locator("[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
}

for (const [locale, theme, width, forcedColors] of [
  ["ko", "light", 390, "none"],
  ["en", "dark", 390, "none"],
  ["en", "light", 1440, "none"],
  ["ko", "dark", 1440, "none"],
  ["ko", "dark", 390, "active"],
  ["en", "light", 1440, "active"],
] as const) {
  test(`MDX layout ${locale}/${theme}/${width}/${forcedColors}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ forcedColors });
    await page.addInitScript(
      (value) => localStorage.setItem("tech-theme", value),
      theme,
    );
    await page.goto(`/${locale}/showcase#mdx`);
    await expectNoHorizontalOverflow(page);
    await expectNoAccessibilityViolations(page, "#mdx");
    const preview = await page
      .locator('[data-mdx-preview="highlight"]')
      .boundingBox();
    const source = await page
      .locator('[data-mdx-source="highlight"]')
      .boundingBox();
    if (!preview || !source) throw new Error("Missing MDX panels");
    if (width < 1024) expect(source.y).toBeGreaterThan(preview.y);
    else expect(source.y).toBe(preview.y);
    await page.screenshot({
      path: testInfo.outputPath("mdx-showcase.png"),
      fullPage: true,
    });
  });
}

test.describe("Showcase without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("source, native disclosure, and glossary remain readable", async ({
    page,
  }) => {
    await page.goto("/ko/showcase#mdx");
    await expect(page.locator("[data-mdx-source] code")).toHaveCount(8);
    const details = page.locator("#mdx details");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await details.getByRole("link").click();
    await expect(
      page.locator("dt#showcase-ko-glossary-idempotency"),
    ).toBeInViewport();
  });
});
