import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "../../e2e-assertions";

test("[성공] 현재 상황 데이터로 Jamie의 작업을 제시함", async ({ page }) => {
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

test("[성공] 작업 대상으로 편집 작업을 전송함", async ({ page }) => {
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

test("[성공] 검색 파일 게시", async ({ page, request }) => {
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

test("[성공] 자동으로 소유할 수 있는 회원은 없습니다", async ({ page }) => {
    await page.goto("/");
    await expectNoAccessibilityViolations(page);
});

test("[성공]뷰포트 내에서 모바일 노드를 유지함", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expectNoHorizontalOverflow(page);
    await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
});

test("[성공] 모션 개념을 위한 이동 모션 및 부드러운 스크롤을 위한 문의", async ({
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
