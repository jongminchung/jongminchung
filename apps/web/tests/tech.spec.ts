import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "./assertions";

test("renders Engineering Notes with isolated site tokens and no overflow", async ({
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

test("searches generated article data and preserves the article across locales", async ({
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

test("retries a failed search index request", async ({ page }) => {
    let requests = 0;
    await page.route("**/search/en.json", async (route) => {
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

test("uses default links for history and same-page hashes", async ({
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

test("loads diagrams and publishes tech discovery files", async ({
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

test("renders remote diagrams through loading and ready states", async ({
    page,
}) => {
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

test("shows a remote diagram request failure", async ({ page }) => {
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

test("remembers the explicit tech locale independently", async ({ page }) => {
    await page.goto("/ko");
    expect(
        (await page.context().cookies()).find(
            ({ name }) => name === "tech-locale",
        )?.value,
    ).toBe("ko");
});

test("hydrates and persists the existing raw theme preference", async ({
    page,
}) => {
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
