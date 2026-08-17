import { expect, test } from "@playwright/test";

test("server HTML declares each route's default document language", async ({
    request,
}) => {
    for (const [path, locale] of [
        ["/en", "en"],
        ["/ko", "ko"],
        ["/diagrams", "en"],
        ["/diagrams/operating-system", "en"],
    ] as const) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        if (path.startsWith("/en") || path.startsWith("/ko")) {
            expect(response.headers()["content-language"], path).toBe(locale);
        }
        expect(await response.text(), path).toMatch(
            new RegExp(`<html[^>]*\\slang="${locale}"`, "u"),
        );
    }
});

test("locale-prefixed 404 responses retain the requested document language", async ({
    request,
}) => {
    for (const [path, locale, heading] of [
        ["/en/not-a-document", "en", "Document not found"],
        ["/ko/not-a-document", "ko", "문서를 찾을 수 없습니다"],
        ["/en/extra", "en", "Document not found"],
        ["/ko/packages/ui", "ko", "문서를 찾을 수 없습니다"],
    ] as const) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(404);
        expect(response.headers()["content-language"], path).toBe(locale);
        const html = await response.text();
        expect(html, path).toContain(`\\"lang\\":\\"${locale}\\"`);
        expect(html, path).toContain(heading);
    }
});
