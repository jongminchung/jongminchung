import { expect, test } from "@playwright/test";

test("[성공] 서버 HTML은 각 위치의 기본 문서 언어를 선언함", async ({
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

test("[성공] 로캘 소개두사가 합류은 404 응답은 요청된 문서 언어를 유지함", async ({
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
