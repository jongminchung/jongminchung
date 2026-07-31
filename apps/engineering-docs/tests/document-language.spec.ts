import { expect, test } from "@playwright/test";

test("server HTML declares each route's default document language", async ({ request }) => {
  for (const [path, locale] of [
    ["/en/overview", "en"],
    ["/ko/overview", "ko"],
    ["/diagrams", "en"],
    ["/diagrams/operating-system", "en"],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`, "u"));
  }
});

test("locale-prefixed 404 responses retain the requested document language", async ({
  request,
}) => {
  for (const [path, locale, heading] of [
    ["/en/not-a-document", "en", "Document not found"],
    ["/ko/not-a-document", "ko", "문서를 찾을 수 없습니다"],
    ["/en/overview/extra", "en", "Document not found"],
    ["/ko/packages/ui", "ko", "문서를 찾을 수 없습니다"],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    const html = await response.text();
    expect(html, path).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`, "u"));
    expect(html, path).toContain(`<title>${heading}</title>`);
    expect(html, path).toContain(heading);
    expect(html, path).toContain(`href="/${locale}/overview"`);
  }
});
