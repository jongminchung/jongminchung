import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "./assertions";

test("plain documents omit material frames while material routes load independent demos", async ({
    page,
}) => {
    await page.goto("/en");
    await expect(page.locator("[data-material-demo]")).toHaveCount(0);

    await page.goto("/en/articles/the-expensive-main-thread");
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
    await page.goto("/ko/articles/throughput-and-latency");

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
    await expectNoHorizontalOverflow(page);
});

test("pixel-processing exceptions remain native Canvas and material frames are accessible", async ({
    page,
}) => {
    await page.goto("/en/articles/the-expensive-main-thread");
    const demo = page.locator(
        '[data-material-demo="the-expensive-main-thread/DynamicPriorityDemo"]',
    );
    await demo.scrollIntoViewIfNeeded();
    await expect(demo).toHaveAttribute("data-material-renderer", "canvas");
    await expect(
        demo.getByRole("button", { name: "Attach 60 photos" }),
    ).toBeVisible();

    await expectNoAccessibilityViolations(page, "[data-material-demo]", [
        "serious",
        "critical",
    ]);
});
