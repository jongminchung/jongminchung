import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("global navigation, breadcrumb, outline, and explained search work by keyboard", async ({
  page,
}) => {
  await page.goto("/en/deep-dive/nextjs-16");
  await expect(page.getByRole("heading", { level: 1, name: "Next.js 16" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
    "DocsDeep DiveNext.js 16",
  );
  await page.getByRole("link", { name: "MDX pipeline" }).click();
  await expect(page).toHaveURL(/#mdx-pipeline$/u);

  await page.keyboard.press("ControlOrMeta+K");
  const search = page.getByPlaceholder("Search titles, APIs, and topics");
  await expect(search).toBeFocused();
  await search.fill("createTsconfigPaths");
  const searchDialog = page.getByRole("dialog", {
    name: "Search documentation",
  });
  await expect(searchDialog.getByText("tooling", { exact: true })).toBeVisible();
  await expect(searchDialog.getByText("API symbol", { exact: true })).toBeVisible();
  await expect(searchDialog.getByText(/createTsconfigPaths/u)).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/packages\/tooling$/u);
});

test("short display titles preserve full SEO titles and consolidate source metadata", async ({
  page,
}) => {
  await page.goto("/en/deep-dive/pnpm-11");
  await expect(page.getByRole("heading", { level: 1, name: "pnpm 11" })).toBeVisible();
  await expect(page).toHaveTitle("pnpm 11 Deep Dive · Jongmin Chung Docs");
  await expect(page.getByText("Verified 2026-07-14", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Official source" })).toHaveCount(1);
  await expect(page.locator("blockquote").filter({ hasText: "Official source" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+K");
  const search = page.getByPlaceholder("Search titles, APIs, and topics");
  await search.fill("pnpm 11");
  await expect(
    page
      .getByRole("dialog", { name: "Search documentation" })
      .getByText("pnpm 11 Deep Dive", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/en/handbook/ddd");
  const attribution = page.locator("blockquote").first();
  await expect(attribution).toContainText("Author: Jongmin Chung · Original: Korean edition");
  await expect(attribution).not.toContainText("Last updated");
});

test("single-document overview navigation uses page headings without a duplicate outline", async ({
  page,
}) => {
  await page.goto("/en/overview");
  await expect(
    page.getByRole("link", {
      name: "The shortest path to a working change",
    }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "On this page" })).toHaveCount(0);
});

test("locale, theme, deprecated banner, and 404 contracts remain visible", async ({ page }) => {
  await page.goto("/en/packages/ui");
  await expect(page.getByText("Deprecated: do not adopt for new work")).toBeVisible();
  await page.getByRole("link", { name: "한국어로 읽기" }).click();
  await expect(page).toHaveURL(/\/ko\/packages\/ui$/u);

  const themeButton = page.getByRole("button", { name: /테마:/u });
  await themeButton.click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");

  await page.goto("/en/not-a-document");
  await expect(page.getByRole("heading", { name: "Document not found" })).toBeVisible();
});

test("mobile drawer follows current section, root tree, another section, and document flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/deep-dive/pnpm-11");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  const navigation = page.getByRole("dialog", {
    name: "Mobile documentation navigation",
  });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "pnpm 11" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toBe("clip");

  await navigation.getByRole("button", { name: "Back to all documentation" }).click();
  await expect(navigation.getByRole("button", { name: "Packages" })).toBeVisible();
  await navigation.getByRole("button", { name: "Packages" }).click();
  await navigation.getByRole("link", { name: "tooling" }).click();
  await expect(page).toHaveURL(/\/en\/packages\/tooling$/u);
  await expect(navigation).toBeHidden();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe("clip");
});

test("responsive shell has stable boundary layouts and mobile CLS below 0.1", async ({
  browser,
}) => {
  const widths = [390, 768, 769, 1023, 1024, 1399, 1400] as const;

  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addInitScript(() => {
      const measuredWindow = window as Window & { __docsCls: number };
      measuredWindow.__docsCls = 0;
      new PerformanceObserver((list) => {
        for (const rawEntry of list.getEntries()) {
          const entry = rawEntry as PerformanceEntry & {
            readonly hadRecentInput: boolean;
            readonly value: number;
          };
          if (!entry.hadRecentInput) measuredWindow.__docsCls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    await page.goto("/en/deep-dive/pnpm-11", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => ({
      articleWidth: document.querySelector("article")?.getBoundingClientRect().width ?? 0,
      cls: (window as Window & { __docsCls: number }).__docsCls,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBe(metrics.viewportWidth);
    if (width >= 769)
      expect(metrics.articleWidth, `article width at ${width}px`).toBeGreaterThan(540);
    if (width === 390) expect(metrics.cls).toBeLessThan(0.1);

    const outline = page.getByRole("complementary", {
      name: "On this page",
    });
    if (width >= 1400) await expect(outline).toBeVisible();
    else await expect(outline).toBeHidden();

    const globalRail = page.locator('nav[aria-label="All documentation"]');
    const tabletMenu = page.getByRole("button", {
      name: "Current section menu",
    });
    const visibleContextNavigation = page.locator(".astryx-side-nav:visible");
    if (width <= 768) {
      await expect(globalRail).toBeHidden();
      await expect(tabletMenu).toBeHidden();
      await expect(visibleContextNavigation).toHaveCount(0);
    } else if (width <= 1023) {
      await expect(globalRail).toBeVisible();
      await expect(tabletMenu).toBeVisible();
      await expect(visibleContextNavigation).toHaveCount(0);
    } else {
      await expect(globalRail).toBeVisible();
      await expect(tabletMenu).toBeHidden();
      await expect(visibleContextNavigation).toHaveCount(1);
    }
    await context.close();
  }
});

test("mobile server HTML does not reserve desktop navigation when JavaScript is disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("/en/deep-dive/pnpm-11");
  const rail = page.locator('nav[aria-label="All documentation"]');
  expect(await rail.boundingBox()).toBeNull();
  const article = await page.locator("article").boundingBox();
  expect(article?.x).toBeLessThan(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

test("code preserves tokens and scrolls horizontally instead of breaking words", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/deep-dive/nextjs-16");
  const codeScroller = page.locator("pre code").first().locator("..").locator("..");
  const metrics = await codeScroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
    scrollWidth: element.scrollWidth,
    whiteSpace: getComputedStyle(element).whiteSpace,
    wordBreak: getComputedStyle(element).wordBreak,
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.overflowX).toBe("auto");
  expect(metrics.whiteSpace).toBe("pre");
  expect(metrics.wordBreak).toBe("normal");
});

test("representative pages have no Axe violations or console warnings", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") messages.push(message.text());
  });

  for (const path of ["/en/handbook/ddd", "/en/packages/ui", "/en/deep-dive/pnpm-11"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `Axe violations at ${path}`).toEqual([]);
  }
  expect(messages).toEqual([]);
});
