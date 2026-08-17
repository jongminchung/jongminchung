import { expect, test } from "@playwright/test";

test("section landings feature the latest update and preserve localized navigation", async ({
    page,
}) => {
    await page.goto("/ko/series/deep-dive");

    await expect(
        page.getByRole("heading", { level: 1, name: "Deep Dive" }),
    ).toBeVisible();
    const featured = page.locator('a[data-variant="featured"]');
    await expect(featured).toHaveCount(1);
    await expect(featured).toHaveAttribute(
        "href",
        "/ko/articles/typescript-7-compatibility",
    );
    await expect(featured.locator("img")).toHaveAttribute(
        "src",
        "/og/ko/deep-dive/typescript-7-compatibility",
    );

    const globalNavigation = page.getByRole("navigation", {
        name: "전체 문서",
    });
    await expect(
        globalNavigation.getByRole("link", { name: "Deep Dive" }),
    ).toHaveAttribute("href", "/ko/series/deep-dive");
    await expect(
        page.getByRole("link", { name: "Read in English" }),
    ).toHaveAttribute("href", "/en/series/deep-dive");
});

test("document outline follows the visible heading and exposes the active location", async ({
    page,
}) => {
    await page.goto("/en/articles/nextjs-16");
    const outline = page.getByRole("complementary", { name: "On this page" });
    const target = page.getByRole("heading", {
        level: 2,
        name: "MDX pipeline",
    });

    await target.evaluate((element) =>
        element.scrollIntoView({ block: "start" }),
    );
    await expect
        .poll(() =>
            outline
                .getByRole("link", { name: "MDX pipeline" })
                .getAttribute("aria-current"),
        )
        .toBe("location");
});

test("related documentation is deterministic and excludes the current document", async ({
    page,
}) => {
    await page.goto("/en/articles/typescript-6");
    const related = page.getByRole("region", { name: "Related documentation" });
    await expect(related).toBeVisible();
    await expect(related.locator("a")).toHaveCount(3);
    expect(
        await related
            .locator("a")
            .evaluateAll((links) =>
                links.map((link) => link.getAttribute("href")),
            ),
    ).toEqual([
        "/en/articles/typescript-7-compatibility",
        "/en/articles/node-26",
        "/en/articles/building-calculator-engine",
    ]);
    await expect(
        related.locator('a[href="/en/articles/typescript-6"]'),
    ).toHaveCount(0);
});

test("OG images and llms.txt expose static discovery assets", async ({
    page,
    request,
}) => {
    await page.goto("/en/articles/typescript-7-compatibility");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        "https://tech.jamie.kr/og/en/deep-dive/typescript-7-compatibility",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
    );

    const image = await request.get(
        "/og/ko/deep-dive/server-monitoring-analysis-guide",
    );
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
    expect([...(await image.body()).subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
    ]);

    const llms = await request.get("/llms.txt");
    expect(llms.ok()).toBe(true);
    expect(llms.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    expect(await llms.text()).toContain(
        "[TypeScript 7 Compatibility Verification](https://tech.jamie.kr/en/articles/typescript-7-compatibility)",
    );
});
