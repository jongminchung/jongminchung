import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("presents Jamie's work with valid metadata", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Jamie — Jongmin Chung");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Complex systemsshould explainthemselves.",
    );
    await expect(page.locator('[data-project="true"]').first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://jamie.kr/en",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        /\/og$/u,
    );
    await expect(
        page.getByRole("link", { name: "jongminchung home" }),
    ).toContainText("jongminchung");
});

test("renders editorial actions with working destinations", async ({
    page,
}) => {
    await page.goto("/");

    const workAction = page.getByRole("link", { name: "Read the work" });
    const docsAction = page.getByRole("link", {
        name: "Open Engineering Notes",
    });

    await expect(workAction).toHaveAttribute("href", "#work");
    await expect(workAction).toHaveCSS("min-height", "50px");
    await expect(docsAction).toHaveAttribute(
        "href",
        "https://tech.jamie.kr/en",
    );
    await workAction.click();
    await expect(page).toHaveURL(/#work$/u);
});

test("publishes domain discovery files", async ({ page, request }) => {
    await page.goto("/en");
    const socialImageUrl = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
    expect(socialImageUrl).not.toBeNull();
    const [favicon, robots, sitemap, socialImage] = await Promise.all([
        request.get("/icon.svg"),
        request.get("/robots.txt"),
        request.get("/sitemap.xml"),
        request.get(new URL(socialImageUrl ?? "", "https://jamie.kr").pathname),
    ]);

    expect(favicon.ok()).toBe(true);
    expect(await favicon.text()).not.toContain("<text");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("https://jamie.kr/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("https://jamie.kr");
    expect(socialImage.ok()).toBe(true);
    expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("has no automatically detectable accessibility violations", async ({
    page,
}) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
});

test("keeps the mobile layout within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const viewport = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewport.scrollWidth).toBe(viewport.clientWidth);
    await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
});

test("disables route motion and smooth scrolling for reduced motion", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const route = page
        .locator(
            '[aria-label="Language becomes a model, code, and proof"] path',
        )
        .nth(1);
    await expect(route).toBeVisible();
    const routeStyle = await route.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            animationName: style.animationName,
            strokeDashoffset: style.strokeDashoffset,
            transitionDuration: style.transitionDuration,
        };
    });
    expect(routeStyle).toEqual({
        animationName: "none",
        strokeDashoffset: "0px",
        transitionDuration: "0s",
    });
    expect(
        await page.evaluate(
            () => getComputedStyle(document.documentElement).scrollBehavior,
        ),
    ).toBe("auto");
});
