import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../../e2e-assertions";

const cases = [
  {
    name: "investment-wide-light",
    path: "/en",
    heading: "Investment research grounded in filings and primary sources",
    contract: "index",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "investment-mobile-dark",
    path: "/en",
    heading: "Investment research grounded in filings and primary sources",
    contract: "index",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "investment-note-wide-light",
    path: "/ko/notes/reading-the-13f-difference",
    heading:
      "같은 13F라도 버핏, 드러켄밀러, 브리지워터는 전혀 다르게 읽어야 함",
    contract: "editorial",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "investment-note-mobile-light",
    path: "/ko/notes/reading-the-13f-difference",
    heading:
      "같은 13F라도 버핏, 드러켄밀러, 브리지워터는 전혀 다르게 읽어야 함",
    contract: "editorial",
    width: 390,
    height: 844,
    theme: "light",
  },
] as const;

const screenshotCases = new Set([
  "investment-wide-light",
  "investment-mobile-dark",
  "investment-note-mobile-light",
]);

for (const visualCase of cases) {
  test(`visual: ${visualCase.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    });
    await page.addInitScript(
      (theme) => localStorage.setItem("invest-theme", theme),
      visualCase.theme,
    );
    await page.goto(visualCase.path);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", { level: 1, name: visualCase.heading }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    if (visualCase.contract === "editorial") {
      const article = page.locator('[data-editorial-article="true"]');
      const paragraph = article.locator("h2 + p").first();
      const tableScroller = article
        .locator("figure > div.overflow-x-auto")
        .first();

      await expect(article).toBeVisible();
      await expect(paragraph).toBeVisible();
      await expect
        .poll(() =>
          article.evaluate((element) => element.getBoundingClientRect().width),
        )
        .toBeLessThanOrEqual(760);
      await expect
        .poll(() =>
          paragraph.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              marginBottom: style.marginBottom,
            };
          }),
        )
        .toEqual({
          fontSize: "16px",
          lineHeight: "28px",
          marginBottom: "16px",
        });

      if (visualCase.width <= 600) {
        const title = page.getByRole("heading", {
          level: 1,
          name: visualCase.heading,
        });
        await expect
          .poll(() =>
            title.evaluate(
              (element) =>
                element.getBoundingClientRect().right <=
                document.documentElement.clientWidth,
            ),
          )
          .toBe(true);
        await expect
          .poll(() =>
            tableScroller.evaluate((element) => ({
              isContained:
                element.getBoundingClientRect().right <=
                document.documentElement.clientWidth,
              isScrollable: element.scrollWidth > element.clientWidth,
            })),
          )
          .toEqual({ isContained: true, isScrollable: true });
      }
    }

    await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), {
                once: true,
              });
            });
          }
          await image.decode().catch(() => undefined);
        }),
      );
    });
    if (screenshotCases.has(visualCase.name))
      await expect(page).toHaveScreenshot(`${visualCase.name}.png`);
  });
}
