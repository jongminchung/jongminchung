import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("plain documents omit material frames while material routes load independent demos", async ({
    page,
}) => {
    await page.goto("/en/overview");
    await expect(page.locator("[data-material-demo]")).toHaveCount(0);

    await page.goto("/en/deep-dive/the-expensive-main-thread");
    const demo = page.locator(
        '[data-material-demo="the-expensive-main-thread/DynamicPriorityDemo"]',
    );
    await demo.scrollIntoViewIfNeeded();
    await expect(
        demo.getByRole("button", { name: "Attach 60 photos" }),
    ).toBeVisible();
});

test("material demos preload near the viewport and unmount offscreen", async ({
    page,
}) => {
    await page.goto("/ko/deep-dive/throughput-and-latency");

    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "처리량과 지연 시간",
        }),
    ).toBeVisible();
    const demos = page.locator("[data-material-demo]");
    await expect(demos).toHaveCount(8);

    const firstDemo = page.locator(
        '[data-material-demo="throughput-and-latency/ConcurrencyVsParallelismDiagram"]',
    );
    await firstDemo.scrollIntoViewIfNeeded();
    await expect(firstDemo.locator("figure")).toBeVisible();

    await demos.last().scrollIntoViewIfNeeded();
    await expect(firstDemo).toHaveAttribute("data-material-active", "false");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(390);
});

test("reduced motion renders a stable representative Motion frame", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en/deep-dive/the-expensive-main-thread");
    const demo = page.locator(
        '[data-material-demo="the-expensive-main-thread/TransformVsLayoutDemo"]',
    );
    await demo.scrollIntoViewIfNeeded();
    const animated = demo.locator("[style*='will-change']").first();
    await expect(animated).toBeVisible();
    const frame = await animated.getAttribute("style");
    await page.waitForTimeout(250);
    expect(await animated.getAttribute("style")).toBe(frame);
});

test("pixel-processing exceptions remain native Canvas and material frames are accessible", async ({
    page,
}) => {
    await page.goto("/en/deep-dive/the-expensive-main-thread");
    const demo = page.locator(
        '[data-material-demo="the-expensive-main-thread/DynamicPriorityDemo"]',
    );
    await demo.scrollIntoViewIfNeeded();
    await expect(demo).toHaveAttribute("data-material-renderer", "canvas");
    await expect(
        demo.getByRole("button", { name: "Attach 60 photos" }),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
        .include("[data-material-demo]")
        .analyze();
    expect(
        accessibility.violations.filter((violation) =>
            ["serious", "critical"].includes(violation.impact ?? ""),
        ),
    ).toEqual([]);
});
