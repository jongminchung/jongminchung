import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createRssResponse } from "./rss";
import { siteOrigins } from "./site-routing";

describe("공통 RSS protocol", () => {
  for (const site of ["tech", "invest"] as const) {
    for (const locale of ["ko", "en"] as const) {
      it(`${site} ${locale}: 특수문자·URL·날짜·헤더를 보존함`, async () => {
        const title = `한글 & <tag> "quote" 'apostrophe'`;
        const href = `/${locale}/note?a=1&b=2`;
        const response = createRssResponse({
          origin: siteOrigins[site],
          locale,
          title,
          description: title,
          items: [
            { title, description: title, href, publishedAt: "2026-09-06" },
          ],
        });
        expect(response.headers.get("Content-Type")).toBe(
          "application/rss+xml; charset=utf-8",
        );
        expect(response.headers.get("Cache-Control")).toBe(
          "public, max-age=3600, s-maxage=86400",
        );
        const xml = await response.text();
        expect(xml).toContain("&amp;");
        expect(xml).toContain("&lt;tag&gt;");
        expect(xml).toContain("&quot;");
        expect(xml).toContain("&apos;");
        const window = new Window();
        try {
          const document = new window.DOMParser().parseFromString(
            xml,
            "application/xml",
          );
          expect(document.querySelector("parsererror")).toBeNull();
          expect(document.querySelector("channel > title")?.textContent).toBe(
            title,
          );
          expect(
            document.querySelector("item > description")?.textContent,
          ).toBe(title);
          expect(document.querySelector("item > link")?.textContent).toBe(
            `${siteOrigins[site]}${href}`,
          );
          expect(document.querySelector("guid")?.textContent).toBe(
            `${siteOrigins[site]}${href}`,
          );
          expect(document.querySelector("language")?.textContent).toBe(
            locale === "ko" ? "ko-KR" : "en-US",
          );
          expect(document.querySelector("pubDate")?.textContent).toBe(
            "Sun, 06 Sep 2026 00:00:00 GMT",
          );
        } finally {
          await window.happyDOM.close();
        }
      });
    }
  }
  it("빈 collection도 유효한 channel을 반환함", async () => {
    const response = createRssResponse({
      origin: siteOrigins.tech,
      locale: "en",
      title: "Empty",
      description: "Empty",
      items: [],
    });
    expect(await response.text()).toContain("</language></channel></rss>");
  });
});
