import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the bilingual empty research journal without horizontal overflow", async ({
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
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
        ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("publishes independent investment discovery files", async ({
    request,
}) => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/en/rss.xml"]) {
        const response = await request.get(path);
        expect(response.ok(), path).toBe(true);
    }
});

test("selects and remembers the investment locale", async ({ page }) => {
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
