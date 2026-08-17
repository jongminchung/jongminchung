import { expect, test } from "@playwright/test";

test("rejects private paths, unknown hosts, and spoofed routing headers", async ({
    request,
    playwright,
}) => {
    expect((await request.get("/sites/tech/en")).status()).toBe(404);
    const unknown = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3100",
        extraHTTPHeaders: {
            Host: "unknown.example",
            "X-Jamie-Internal-Rewrite": "1",
            "X-Jamie-Locale": "ko",
            "X-Jamie-Site": "tech",
        },
    });
    expect((await unknown.get("/")).status()).toBe(404);
    expect((await unknown.get("/sites/tech/ko")).status()).toBe(404);
    await unknown.dispose();
});

test("uses Host and ignores X-Forwarded-Host", async ({ playwright }) => {
    const spoofed = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3100",
        extraHTTPHeaders: {
            Host: "unknown.example",
            "X-Forwarded-Host": "tech.jamie.localhost:3100",
        },
    });
    expect((await spoofed.get("/en")).status()).toBe(404);
    await spoofed.dispose();

    const allowed = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3100",
        extraHTTPHeaders: {
            Host: "tech.jamie.localhost:3100",
            "X-Forwarded-Host": "unknown.example",
        },
    });
    expect((await allowed.get("/en")).status()).toBe(200);
    await allowed.dispose();
});

test("redirects each site root with cookie before Accept-Language", async ({
    playwright,
}) => {
    for (const [host, cookie] of [
        ["jamie.localhost:3100", "home-locale=en"],
        ["tech.jamie.localhost:3100", "tech-locale=en"],
        ["invest.jamie.localhost:3100", "invest-locale=en"],
    ] as const) {
        const context = await playwright.request.newContext({
            baseURL: "http://127.0.0.1:3100",
            extraHTTPHeaders: {
                "Accept-Language": "ko-KR,ko;q=0.9",
                Cookie: cookie,
                Host: host,
            },
        });
        const response = await context.get("/", { maxRedirects: 0 });
        expect(response.status(), host).toBe(307);
        expect(response.headers().location, host).toBe(`http://${host}/en`);
        expect(response.headers().vary, host).toBe("Cookie, Accept-Language");
        await context.dispose();
    }

    const negotiated = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3100",
        extraHTTPHeaders: {
            "Accept-Language": "fr, ko;q=0.8, en;q=0.5",
            Host: "tech.jamie.localhost:3100",
        },
    });
    expect(
        (await negotiated.get("/", { maxRedirects: 0 })).headers().location,
    ).toBe("http://tech.jamie.localhost:3100/ko");
    await negotiated.dispose();
});

test("localizes not-found documents for every site", async ({ browser }) => {
    for (const host of [
        "jamie.localhost:3100",
        "tech.jamie.localhost:3100",
        "invest.jamie.localhost:3100",
    ]) {
        const page = await browser.newPage();
        const response = await page.goto(`http://${host}/ko/not-a-page`);
        if (response === null)
            throw new Error(`No response received for ${host}`);
        expect(response.status(), host).toBe(404);
        expect(response.headers()["content-language"], host).toBe("ko");
        await expect(page.locator("html"), host).toHaveAttribute("lang", "ko");
        await expect(
            page.getByRole("heading", { name: "문서를 찾을 수 없습니다" }),
            host,
        ).toBeVisible();
        await page.close();
    }
});

test("serves health independently of the host", async ({ playwright }) => {
    const health = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3100",
        extraHTTPHeaders: { Host: "unknown.example" },
    });
    const response = await health.get("/healthz");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    await health.dispose();
});
