import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("uses the canonical app icon for navigation and metadata", async ({ page, request }) => {
  await page.goto("/en/overview");
  const personalIcon = page.getByRole("link", { name: "Jongmin Chung Docs" }).locator("img");
  await expect(personalIcon).toHaveAttribute("alt", "");
  await expect(personalIcon).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/u);

  const favicon = await request.get("/icon.svg");
  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<text");
});

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

test("internal navigation keeps the shell fixed while transitioning document content", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const measuredWindow = window as Window & { __docsViewTransitions: number };
    measuredWindow.__docsViewTransitions = 0;
    if (typeof document.startViewTransition !== "function") return;

    const startViewTransition = document.startViewTransition.bind(document);
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (callback: Parameters<Document["startViewTransition"]>[0]) => {
        measuredWindow.__docsViewTransitions += 1;
        return startViewTransition(callback);
      },
    });
  });

  await page.goto("/en/deep-dive/nextjs-16");
  const rail = page.locator('nav[aria-label="All documentation"]');
  const initialRail = await rail.boundingBox();
  const content = page.locator("[data-docs-transition-content]");
  await expect
    .poll(() => content.evaluate((element) => getComputedStyle(element).viewTransitionName))
    .toBe("docs-content");

  await page
    .locator('nav[aria-label="Side navigation"]:visible')
    .getByRole("link", { name: "pnpm 11", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/deep-dive\/pnpm-11$/u);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __docsViewTransitions: number }).__docsViewTransitions,
      ),
    )
    .toBeGreaterThan(0);

  const finalRail = await rail.boundingBox();
  expect(finalRail?.x).toBe(initialRail?.x);
  expect(finalRail?.width).toBe(initialRail?.width);
  await expect(page.locator("[data-docs-navigation-progress]")).toHaveCount(0);
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
  await expect(page.locator("article figure")).toHaveCount(0);
  await expect(page.getByText(/knowledge path|지식 경로/iu)).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('[data-overview-hero="true"]')
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toBe("none");
});

test("locale, theme, removed package, and 404 contracts remain visible", async ({ page }) => {
  await page.goto("/en/packages/remark-plantuml");
  await page.getByRole("link", { name: "한국어로 읽기" }).click();
  await expect(page).toHaveURL(/\/ko\/packages\/remark-plantuml$/u);

  const themeButton = page.getByRole("button", { name: /테마:/u });
  await themeButton.click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");

  for (const locale of ["en", "ko"] as const) {
    const response = await page.goto(`/${locale}/packages/ui`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", {
        name: "Document not found",
      }),
    ).toBeVisible();
  }

  await page.goto("/en/not-a-document");
  await expect(page.getByRole("heading", { name: "Document not found" })).toBeVisible();
});

test("document typography uses the Angular metric contract in both locales", async ({
  browser,
}) => {
  const cases = [
    { locale: "en", width: 1440 },
    { locale: "ko", width: 1024 },
    { locale: "en", width: 390 },
  ] as const;

  for (const { locale, width } of cases) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`/${locale}/packages/remark-plantuml`);
    const metrics = await page.evaluate(() => {
      const article = document.querySelector("article");
      const prose = document.querySelector('[data-docs-prose="true"]');
      const title = article?.querySelector("h1");
      const heading = prose?.querySelector("h2");
      const paragraph = prose?.querySelector("p");
      const listItem = prose?.querySelector("li");
      const code = prose?.querySelector("pre code");
      if (
        !(article instanceof HTMLElement) ||
        !(title instanceof HTMLElement) ||
        !(heading instanceof HTMLElement) ||
        !(paragraph instanceof HTMLElement) ||
        !(listItem instanceof HTMLElement) ||
        !(code instanceof HTMLElement)
      ) {
        throw new Error("Expected representative document typography elements.");
      }
      const titleStyle = getComputedStyle(title);
      const headingStyle = getComputedStyle(heading);
      const paragraphStyle = getComputedStyle(paragraph);
      const listStyle = getComputedStyle(listItem);
      const codeStyle = getComputedStyle(code);
      return {
        articleWidth: article.getBoundingClientRect().width,
        bodyFontFamily: paragraphStyle.fontFamily,
        bodyFontSize: paragraphStyle.fontSize,
        bodyLetterSpacing: paragraphStyle.letterSpacing,
        bodyLineHeight: paragraphStyle.lineHeight,
        codeFontFamily: codeStyle.fontFamily,
        codeFontSize: codeStyle.fontSize,
        headingFontSize: headingStyle.fontSize,
        headingFontWeight: headingStyle.fontWeight,
        listLetterSpacing: listStyle.letterSpacing,
        titleFontFamily: titleStyle.fontFamily,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
      };
    });

    expect(metrics.articleWidth).toBeLessThanOrEqual(710);
    expect(metrics.bodyFontFamily).toContain("Inter");
    expect(metrics.bodyFontSize).toBe("14px");
    expect(metrics.bodyLineHeight).toBe("22.4px");
    expect(metrics.bodyLetterSpacing).toBe("-0.14px");
    expect(metrics.listLetterSpacing).toBe("-0.16px");
    expect(metrics.titleFontFamily).toContain("Inter Tight");
    expect(metrics.titleFontSize).toBe("36px");
    expect(metrics.titleFontWeight).toBe("500");
    expect(metrics.headingFontSize).toBe("32px");
    expect(metrics.headingFontWeight).toBe("500");
    expect(metrics.codeFontFamily).toContain("DM Mono");
    expect(metrics.codeFontSize).toBe("14px");
    await context.close();
  }
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
  const codeBlock = page.locator(".astryx-codeblock.docs-code-block").first();
  const codeScroller = codeBlock.locator('[role="group"]');
  const firstLine = codeBlock.locator("[data-line]").first();
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
  await expect(codeBlock).toHaveCSS("border-radius", "4px");
  await expect(codeBlock.locator("code")).toHaveCSS("font-size", "14px");
  await expect(firstLine).toHaveCSS("padding-left", "16px");
  await expect(firstLine).toHaveCSS("padding-top", "4px");

  const copyButton = codeBlock.getByRole("button", { name: "Copy code" });
  await expect(copyButton).toHaveCSS("opacity", "0");
  await codeBlock.hover();
  await expect(copyButton).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await copyButton.focus();
  await expect(copyButton).toHaveCSS("opacity", "1");
});

test("representative pages have no Axe violations or console warnings", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") messages.push(message.text());
  });

  for (const path of [
    "/en/handbook/ddd",
    "/en/packages/remark-plantuml",
    "/en/deep-dive/pnpm-11",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `Axe violations at ${path}`).toEqual([]);
  }
  expect(messages).toEqual([]);
});
