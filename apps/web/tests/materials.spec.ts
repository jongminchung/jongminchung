import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "./assertions";

test("[성공] 일반 문서 데이터 프레임이 있고 데이터 경로는 관련인 템플릿을 로드함", async ({
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

test("[성공] 머티리얼 데모는 데비포트 배경화면에 미리 로드하고 화면을 움직이며 휴가함", async ({
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

test("[성공] 광대 처리 이벤트는 기본 캔버스로 유지 관리 프레임에 액세스할 수 있음", async ({
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
