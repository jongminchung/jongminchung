import { expect, test } from "@playwright/test";

const cases = [
  {
    name: "overview-wide-light",
    path: "/en",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "overview-tablet-light",
    path: "/ko",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "overview-mobile-dark",
    path: "/en",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "cilium-series-wide-light",
    path: "/ko/series/cilium-gateway-api",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "domain-design-series-mobile-dark",
    path: "/en/series/domain-driven-design",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "frontend-docs-tutorial-wide-light",
    path: "/ko/tutorial-maintainable-tailwind-shadcn",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "frontend-docs-explanation-mobile-dark",
    path: "/en/why-tailwind-shadcn-maintainability-needs-ownership",
    width: 390,
    height: 844,
    theme: "dark",
  },
  {
    name: "ddd-wide-light",
    path: "/ko/ddd",
    width: 1440,
    height: 1000,
    theme: "light",
  },
  {
    name: "article-dark",
    path: "/en/typescript-7-compatibility",
    width: 1440,
    height: 1000,
    theme: "dark",
  },
  {
    name: "deep-dive-tablet",
    path: "/en/nextjs-16",
    width: 1024,
    height: 900,
    theme: "light",
  },
  {
    name: "deep-dive-mobile-light",
    path: "/en/pnpm-11",
    width: 390,
    height: 844,
    theme: "light",
  },
  {
    name: "ddd-tablet-dark",
    path: "/ko/ddd",
    width: 1024,
    height: 900,
    theme: "dark",
  },
] as const;

for (const visualCase of cases) {
  test(`visual: ${visualCase.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: visualCase.width,
      height: visualCase.height,
    });
    await page.addInitScript(
      (theme) => localStorage.setItem("tech-theme", theme),
      visualCase.theme,
    );
    await page.goto(visualCase.path);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), {
                once: true,
              });
              image.addEventListener("error", () => resolve(), {
                once: true,
              });
            });
          }
          await image.decode().catch(() => undefined);
        }),
      );
    });
    await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
      fullPage: true,
    });
  });
}
