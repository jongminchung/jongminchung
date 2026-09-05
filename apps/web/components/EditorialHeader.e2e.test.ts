import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../e2e-assertions";

const sites = [
  {
    id: "home",
    origin: "http://jamie.localhost:3100",
    menu: "Home menu",
    path: "",
    link: "Tech",
  },
  {
    id: "tech",
    origin: "http://tech.jamie.localhost:3100",
    menu: "Engineering content menu",
    path: "/docs/be/ddd",
    link: "Blog",
  },
  {
    id: "invest",
    origin: "http://invest.jamie.localhost:3100",
    menu: "Investment content menu",
    path: "/notes/reading-the-13f-difference",
    link: "Notes",
  },
] as const;

for (const site of sites) {
  for (const locale of ["en", "ko"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`${site.id}/${locale}/${theme}: shared header dimensions and breakpoints`, async ({
        page,
      }) => {
        await page.addInitScript(
          ({ key, theme }) => localStorage.setItem(key, theme),
          { key: `${site.id}-theme`, theme },
        );
        await page.goto(`${site.origin}/${locale}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const header = page.locator("header").first();
        const brand = header.getByRole("link", {
          name: `jongminchung ${site.id}`,
        });
        for (const width of [320, 390, 767, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await expect(header).toHaveCSS("height", "64px");
          await expect(brand.locator(":scope > span")).toHaveCSS(
            "font-size",
            "20px",
          );
          const brandBox = await brand.boundingBox();
          expect(brandBox?.x).toBe(width < 768 ? 16 : 32);
          expect((brandBox?.y ?? 0) + (brandBox?.height ?? 0) / 2).toBeCloseTo(
            31.5,
          );
          const nav = header.getByRole("navigation");
          if (width < 768) await expect(nav).toBeHidden();
          else {
            await expect(nav).toBeVisible();
            const navBox = await nav.boundingBox();
            const headerBox = await header.boundingBox();
            expect(
              Math.abs(
                (navBox?.x ?? 0) +
                  (navBox?.width ?? 0) / 2 -
                  (headerBox?.width ?? 0) / 2,
              ),
            ).toBeLessThan(0.1);
          }
          const boxes = await header
            .locator("a:visible, button:visible")
            .evaluateAll((elements) =>
              elements.map((element) => {
                const { x, y, width, height, right } =
                  element.getBoundingClientRect();
                return { x, y, width, height, right };
              }),
            );
          for (const box of boxes) {
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.right).toBeLessThanOrEqual(
              width - (width < 768 ? 16 : 32),
            );
          }
          const sorted = boxes.toSorted((a, b) => a.x - b.x);
          for (const [index, box] of sorted.entries()) {
            const previous = sorted[index - 1];
            if (previous) expect(box.x).toBeGreaterThanOrEqual(previous.right);
          }
          await expectNoHorizontalOverflow(page);
          if (site.id === "home") {
            const github = header.getByRole("link", { name: "GitHub" });
            if (width >= 1024) await expect(github).toBeVisible();
            else await expect(github).toBeHidden();
          }
        }
      });
    }
  }

  test(`${site.id}: mobile keyboard, close, focus return and language path`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.addInitScript(
      (key) => localStorage.setItem(key, "light"),
      `${site.id}-theme`,
    );
    await page.goto(`${site.origin}/en${site.path}`);
    await expect(
      page.getByRole("button", { name: "Theme: light" }),
    ).toBeVisible();
    const trigger = page.getByRole("button", { name: site.menu, exact: true });
    const dialog = page.getByRole("dialog", { name: site.menu });
    await trigger.click();
    await dialog.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: site.link, exact: true }),
    ).toBeVisible();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        )
        .toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    const language = dialog.getByRole("link", { name: "한국어로 읽기" });
    await expect(language).toHaveAttribute("href", `/ko${site.path}`);
    const languageBox = await language.boundingBox();
    expect(languageBox?.width).toBeGreaterThanOrEqual(44);
    expect(languageBox?.height).toBeGreaterThanOrEqual(44);
    await language.click();
    await expect(page).toHaveURL(`${site.origin}/ko${site.path}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test(`${site.id}: mobile navigation without JavaScript`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 720 },
    });
    try {
      const page = await context.newPage();
      await page.goto(`${site.origin}/en${site.path}`);
      const fallback = page.locator("noscript nav");
      await expect(
        fallback.getByRole("link", { name: site.link, exact: true }),
      ).toBeVisible();
      const language = fallback.getByRole("link", { name: "한국어로 읽기" });
      await expect(language).toHaveAttribute("href", `/ko${site.path}`);
      await language.click();
      await expect(page).toHaveURL(`${site.origin}/ko${site.path}`);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

test("Home menu anchors close the menu and clear the sticky header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://jamie.localhost:3100/en");
  for (const [name, id] of [
    ["Latest notes", "writing"],
    ["Principles", "principles"],
  ]) {
    await page.getByRole("button", { name: "Home menu" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("link", { name, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`#${id}$`, "u"));
    await expect(page.locator(`#${id}-title`)).toBeInViewport();
    expect(
      (await page.locator(`#${id}`).boundingBox())?.y,
    ).toBeGreaterThanOrEqual(64);
  }
});

test("Site themes persist independently across navigation and reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  for (const site of sites) {
    await page.goto(`${site.origin}/en`);
    await expect(
      page.getByRole("button", { name: "Theme: system" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Theme: system" }).click();
    if (site.id !== "tech")
      await page.getByRole("button", { name: "Theme: light" }).click();
  }
  for (const site of sites) {
    await page.goto(`${site.origin}/en${site.path}`);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      site.id === "tech" ? "light" : "dark",
    );
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        `${site.id}-theme`,
      ),
    ).toBe(site.id === "tech" ? "light" : "dark");
  }
});

for (const site of sites) {
  test(`${site.id}: switching to desktop dismisses the mobile menu and restores usable focus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 767, height: 720 });
    await page.addInitScript(
      (key) => localStorage.setItem(key, "light"),
      `${site.id}-theme`,
    );
    await page.goto(`${site.origin}/en`);
    await expect(
      page.getByRole("button", { name: "Theme: light" }),
    ).toBeVisible();
    const trigger = page.getByRole("button", { name: site.menu, exact: true });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.setViewportSize({ width: 768, height: 720 });
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: `jongminchung ${site.id}` }),
    ).toBeFocused();
    await page.mouse.wheel(0, 300);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await page.setViewportSize({ width: 767, height: 720 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}

for (const locale of ["en", "ko"]) {
  test(`${locale}: a short mobile menu keeps its close button accessible while scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 360 });
    await page.addInitScript(() => localStorage.setItem("tech-theme", "light"));
    await page.goto(`http://tech.jamie.localhost:3100/${locale}`);
    await expect(
      page.getByRole("button", {
        name: `${locale === "en" ? "Theme" : "테마"}: light`,
      }),
    ).toBeVisible();
    const trigger = page.getByRole("button", {
      name: locale === "en" ? "Engineering content menu" : "기술 콘텐츠 메뉴",
    });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const language = dialog.getByRole("link", {
      name: locale === "en" ? "한국어로 읽기" : "Read in English",
    });
    await language.scrollIntoViewIfNeeded();
    await expect(language).toBeInViewport({ ratio: 1 });
    const close = dialog.getByRole("button", {
      name: locale === "en" ? "Close menu" : "메뉴 닫기",
    });
    await expect(close).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("heading")).toBeInViewport({ ratio: 1 });
    const closeBox = await close.boundingBox();
    expect(closeBox?.width).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("The desktop Docs menu has touch-sized options and closes when switching to mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 720 });
  await page.addInitScript(() => localStorage.setItem("tech-theme", "light"));
  await page.goto("http://tech.jamie.localhost:3100/en");
  await expect(
    page.getByRole("button", { name: "Theme: light" }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: /^Docs:/u });
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  for (const item of await page.getByRole("menuitem").all()) {
    await expect(item).toHaveCSS("min-height", "44px");
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.setViewportSize({ width: 767, height: 720 });
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(
    page.locator("header").getByRole("link", { name: "jongminchung tech" }),
  ).toBeFocused();
  await page.setViewportSize({ width: 768, height: 720 });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});
