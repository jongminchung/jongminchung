import { expect, test } from "@playwright/test";
import {
    expectNoAccessibilityViolations,
    expectNoHorizontalOverflow,
} from "../../e2e-assertions";

test("[실패] 수평 바닥 바닥 없이 더블 언어 빈 연구 보고서를 제출함", async ({
    page,
}) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Investment Notes/u);
    await expect(
        page.getByRole("link", { name: "jongminchung invest" }),
    ).toContainText("jongminchunginvest");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "boundary between summary and judgment",
    );
    await expect(
        page.getByText("The first research note is in preparation"),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAccessibilityViolations(page);
});

test("[성공] 관계자 투자 관찰 파일을 게시함", async ({ request }) => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/en/rss.xml"]) {
        const response = await request.get(path);
        expect(response.ok(), path).toBe(true);
    }
});

test("[성공] 투자 장소를 선택하고 기억함", async ({ page }) => {
    await page.goto("/ko");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "요약과 해석",
    );
    expect(
        (await page.context().cookies()).find(
            ({ name }) => name === "invest-locale",
        )?.value,
    ).toBe("ko");
});
