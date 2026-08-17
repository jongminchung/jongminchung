import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "../../e2e-assertions";

test("[성공] 캔팅된 사이트를 사용하고 외부 플로어 주차장을 주차함", async ({
    page,
}) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Understand the problem",
    );
    await expect(page.locator("body")).toHaveAttribute("data-site", "tech");
    await expect(
        page.getByRole("link", { name: "jongminchung tech" }).first(),
    ).toContainText("jongminchungtech");
    await expectNoHorizontalOverflow(page);
    await expectNoAccessibilityViolations(page);
});

test("[성공] 생성된 기사 데이터를 검색하고 여러 지역에서 기사를 싫어함", async ({
    page,
}) => {
    await page.goto("/en");
    const trigger = page.locator("[data-docs-search-trigger]:visible").first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search documentation" });
    const input = dialog.getByRole("combobox");
    await input.fill("Next.js 16");
    const result = dialog.getByRole("option", { name: /Next\.js 16/u });
    await expect(result).toBeVisible();
    await input.press("Escape");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await input.fill("Next.js 16");
    await expect(result).toBeVisible();
    await input.press("ArrowDown");
    const activeId = await input.getAttribute("aria-activedescendant");
    expect(activeId).not.toBeNull();
    const activeOption = page.locator(`[id="${activeId}"]`);
    await expect(activeOption).toHaveRole("option");
    await expect(activeOption).toContainText("Collaboration");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/en\/articles\/collaboration$/u);
    await page.getByRole("link", { name: "한국어로 읽기" }).click();
    await expect(page).toHaveURL(/\/ko\/articles\/collaboration$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});

test("[성공] 오류 검색 요청을 재시도함", async ({ page }) => {
    let requests = 0;
    await page.route("**/en/search-index", async (route) => {
        requests += 1;
        if (requests <= 2)
            await route.fulfill({ status: 503, body: "unavailable" });
        else await route.continue();
    });
    await page.goto("/en");
    await page.locator("[data-docs-search-trigger]:visible").first().click();
    const dialog = page.getByRole("dialog", { name: "Search documentation" });

    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("button", { name: "Retry" }).click();
    await expect(dialog.getByRole("option").first()).toBeVisible();
    expect(requests).toBe(3);
});

test("[성공] 기록 및 동일 페이지에 대한 기본 링크를 사용함", async ({
    page,
}) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "Handbook" }).first().click();
    await expect(page).toHaveURL(/\/en\/series\/handbook$/u);
    await page.goBack();
    await expect(page).toHaveURL(/\/en$/u);

    await page.goto("/en/articles/nextjs-16");
    const hashLink = page.locator('a[href^="#"]:visible').first();
    const hash = await hashLink.getAttribute("href");
    await hashLink.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`, "u"));
});

test("[성공] 버퍼를 로드하고 기술 검색 파일을 게시함", async ({
    page,
    request,
}) => {
    await page.goto("/diagrams");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Diagrams",
    );
    for (const path of [
        "/robots.txt",
        "/sitemap.xml",
        "/en/rss.xml",
        "/llms.txt",
    ]) {
        expect((await request.get(path)).ok(), path).toBe(true);
    }
});

test("[성공] 로딩 및 준비 상태를 통해 원격 버퍼를 백업함", async ({ page }) => {
    await page.route(
        "**/diagrams/operating-system.excalidraw",
        async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            await route.continue();
        },
    );
    await page.goto("/diagrams/operating-system");
    const diagram = page.getByRole("figure", {
        name: "operating-system.excalidraw",
    });

    await expect(diagram).toHaveAttribute("data-excalidraw-state", "loading");
    await expect(diagram).toHaveAttribute("data-excalidraw-state", "ready");
    await expect(diagram).toHaveAttribute("data-rendered-element-count", "10");
    await expect(diagram).toHaveAttribute("data-source-element-count", "10");
});

test("[성공] 원격 재부팅 요청을 실패로 보여줍니다", async ({ page }) => {
    await page.route("**/diagrams/operating-system.excalidraw", async (route) =>
        route.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.goto("/diagrams/operating-system");
    const diagram = page.getByRole("figure", {
        name: "operating-system.excalidraw",
    });

    await expect(diagram).toHaveAttribute("data-excalidraw-state", "error");
    await expect(diagram.getByRole("alert")).toContainText(
        "Unable to render diagram",
    );
});

test("[성공] 신비한 기술 로케일을 반응으로 기억함", async ({ page }) => {
    await page.goto("/ko");
    expect(
        (await page.context().cookies()).find(
            ({ name }) => name === "tech-locale",
        )?.value,
    ).toBe("ko");
});

test("[성공] 원시 원시 테마 선호도를 수화하고 유지함", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("tech-theme", "dark"));
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const themeControl = page.getByRole("button", { name: "Theme: dark" });
    await themeControl.click();
    await expect(
        page.getByRole("button", { name: "Theme: system" }),
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("tech-theme"))).toBe(
        "system",
    );
});
