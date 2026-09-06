import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/fixtures/ui-primitives");
  await expect(
    page.getByRole("heading", { name: "Shared UI interaction fixture" }),
  ).toBeVisible();
});

test("[성공] Dialog를 닫은 뒤 trigger focus를 복원함", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Shared dialog" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("[성공] Select를 keyboard로 탐색하고 값을 확정함", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: "Fixture branch" });
  await trigger.focus();
  await trigger.press("ArrowDown");

  const listbox = page
    .getByRole("listbox")
    .filter({ has: page.getByRole("option", { name: "Alpha" }) });
  await expect(listbox).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(listbox).toBeHidden();
  await expect(trigger).toContainText("beta");
  await expect(trigger).toBeFocused();
});

test("[성공] Menu를 Escape로 닫고 trigger focus를 복원함", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open actions" });
  await trigger.focus();
  await trigger.press("ArrowDown");

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Open repository" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("[성공] Command active descendant를 option과 연결함", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Filter commands" });
  await input.focus();
  await input.press("Home");
  // SSR markup와 cmdk 등록 완료를 구분하고 시작 선택을 명시함.
  await expect(
    page.getByRole("option", { name: "Open repository", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowDown");

  await expect(input).toHaveAttribute("aria-activedescendant", /.+/u);
  const activeId = await input.getAttribute("aria-activedescendant");
  const activeOption = page.locator(`[id="${activeId}"]`);
  await expect(activeOption).toHaveRole("option");
  await input.press("Enter");

  await expect(page.getByRole("status")).toHaveText(/Selected:/u);
});

for (const { width, theme, zoom, forcedColors } of [
  { width: 390, theme: "dark", zoom: 1, forcedColors: "none" },
  { width: 1440, theme: "light", zoom: 1, forcedColors: "none" },
  { width: 1024, theme: "light", zoom: 1, forcedColors: "none" },
  { width: 1440, theme: "dark", zoom: 2, forcedColors: "none" },
  { width: 390, theme: "light", zoom: 1, forcedColors: "active" },
] as const) {
  test(`검색 조합의 ${width}px ${theme} ${zoom * 100}% ${forcedColors} 환경을 유지함`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ forcedColors });
    // CSS 200% 확대에서 실제 검색창의 reflow와 조작을 검증함.
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
    }, zoom);
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    await page.route("**/ko/search?**", async (route) => {
      if (!decodeURIComponent(route.request().url()).includes("한국어")) {
        await route.fulfill({ json: [] });
        return;
      }
      await route.fulfill({
        json: [
          {
            id: "long-title",
            type: "page",
            content:
              "긴 한국어 제목에서도 검색 결과의 줄바꿈과 말줄임 그리고 키보드 탐색을 확인합니다",
            url: "/ko/docs",
            breadcrumbs: ["Docs"],
          },
        ],
      });
    });
    const cards = page.getByRole("region", { name: "긴 한국어 카드 제목" });
    await expect(cards.getByRole("link")).toHaveCount(2);
    await expect
      .poll(() =>
        cards.evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    const trigger = page.getByRole("button", { name: "한국어 검색 열기" });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("한국어");
    const option = dialog.getByRole("option");
    await expect(option).toHaveCount(1);
    await expect(option).toContainText("긴 한국어 제목");
    // This refactor preserves the existing full mobile width and compact desktop width.
    await expect
      .poll(async () => (await dialog.boundingBox())?.width)
      .toBe(
        width / zoom < 640
          ? await page.evaluate(
              () => document.documentElement.getBoundingClientRect().width,
            )
          : 384 * zoom,
      );
    await expect(dialog.locator('[data-slot="command"]')).toHaveCSS(
      "border-radius",
      "11.2px",
    );
    await expect
      .poll(() =>
        dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(input).toBeFocused();
    // 재개방 직후 이전 query의 캐시 결과와 새 응답의 교체를 구분함.
    const refreshedResults = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/ko/search" &&
        [...url.searchParams.values()].includes("한국어 제목")
      );
    });
    await input.fill("한국어 제목");
    await refreshedResults;
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(option).toHaveCount(1);
    await input.press("ArrowDown");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/ko\/docs$/u);
  });
}

test("소비자가 Command와 입력 wrapper를 직접 스타일링할 수 있음", async ({
  page,
}) => {
  const section = page.getByRole("region", { name: "Command consumer styles" });
  await expect(section.locator('[data-slot="command"]')).toHaveCSS(
    "border-radius",
    "0px",
  );
  await expect(
    section.locator('[data-slot="command-input-wrapper"]'),
  ).toHaveCSS("padding", "0px");
  await expect(
    section.getByRole("combobox", { name: "Custom command" }),
  ).toHaveCSS("font-size", "16px");
});

for (const width of [390, 1440]) {
  test(`${width}px에서 Dialog·Sheet·Select 소비자 스타일과 focus를 유지함`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const metadata = page.locator('[data-token-example="metadata"]');
    await expect(metadata).toHaveCSS("font-size", "10px");
    await expect(metadata).toHaveCSS("letter-spacing", "0.8px");
    await expect(page.locator('[data-token-example="caption"]')).toHaveCSS(
      "font-size",
      "11px",
    );
    await expect(page.locator('[data-token-example="caption"]')).not.toHaveCSS(
      "color",
      await metadata.evaluate((element) => getComputedStyle(element).color),
    );
    for (const [name, expectedWidth, radius] of [
      ["dialog", width < 640 ? 288 : 512, "6.4px"],
      ["sheet", 256, "8px"],
    ] as const) {
      const trigger = page.getByRole("button", { name: `Open custom ${name}` });
      await trigger.click();
      const popup = page.getByRole("dialog", { name: `Custom ${name}` });
      await expect(popup).toHaveCSS("width", `${expectedWidth}px`);
      await expect(popup).toHaveCSS("padding", "24px");
      await expect(popup).toHaveCSS("gap", "24px");
      await expect(popup).toHaveCSS("border-radius", radius);
      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    const trigger = page.getByRole("combobox", { name: "Custom branch" });
    await expect(trigger).toHaveCSS("height", "40px");
    await expect(trigger).toHaveCSS("border-radius", "6.4px");
    await expect(trigger).toHaveCSS("padding-left", "16px");
    await expect(trigger).toHaveCSS("font-size", "11px");
    await trigger.focus();
    await trigger.press("ArrowDown");
    const popup = page.locator('[data-slot="select-content"]');
    await expect(popup).toHaveCSS("width", "256px");
    await expect(popup).toHaveCSS("padding", "8px");
    await expect(popup).toHaveCSS("border-radius", "6.4px");
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
