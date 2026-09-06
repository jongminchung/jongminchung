import { describe, expect, it } from "bun:test";
import { locales } from "../lib/content-model";
import { getDocuments } from "../lib/documents";
import investSitemap from "./(invest)/invest/sitemap";
import { GET as getRobots } from "./(tech)/tech/robots.txt/route";
import techSitemap from "./(tech)/tech/sitemap";

describe("블로그 메타데이터 경로", () => {
  it("[성공] Blog와 Docs의 최종 canonical만 사이트맵에 포함함", async () => {
    const [entries, documents] = await Promise.all([
      techSitemap(),
      getDocuments(),
    ]);
    const urls = entries.map(({ url }) => url);
    for (const locale of locales) {
      expect(urls).toContain(`https://tech.jamie.kr/${locale}`);
      expect(urls).toContain(`https://tech.jamie.kr/${locale}/docs`);
    }
    for (const document of documents)
      expect(urls).toContain(`https://tech.jamie.kr${document.href}`);
    expect(urls).toContain("https://tech.jamie.kr/en/docs/fe/typescript-6");
    expect(urls).toContain("https://tech.jamie.kr/en/series");
    expect(urls).toContain(
      "https://tech.jamie.kr/en/series/building-from-first-principles",
    );
    expect(urls).toContain(
      "https://tech.jamie.kr/en/series/react-ui-architecture",
    );
    expect(urls).toContain(
      "https://tech.jamie.kr/en/series/subscription-first-ai-workspace",
    );
    expect(urls).not.toContain(
      "https://tech.jamie.kr/en/series/domain-driven-design",
    );
    expect(
      urls.some(
        (url) =>
          url.includes("/articles/") ||
          url.endsWith("/series/handbook") ||
          url.endsWith("/series/deep-dive"),
      ),
    ).toBe(false);
    expect(
      entries.every(
        (entry) => entry.alternates?.languages?.["x-default"] !== undefined,
      ),
    ).toBe(true);
  });

  it("[성공] 생성된 사이트 맵을 크롤러에 게시함", async () => {
    expect(await getRobots().text()).toContain(
      "Sitemap: https://tech.jamie.kr/sitemap.xml",
    );
  });

  it("[성공] Invest 사이트맵에 색인 가치가 있는 collection만 포함함", () => {
    const entries = investSitemap();
    const urls = entries.map(({ url }) => url);

    expect(urls).toContain("https://invest.jamie.kr/ko/series/operating-notes");
    expect(urls).toContain("https://invest.jamie.kr/ko/sources/article");
    expect(urls).toContain("https://invest.jamie.kr/ko/tags/systems");
    expect(urls).not.toContain("https://invest.jamie.kr/ko/sources/book");
    expect(urls).not.toContain("https://invest.jamie.kr/ko/tags/efficiency");
    expect(
      entries.every(
        (entry) =>
          entry.lastModified !== undefined &&
          entry.alternates?.languages?.["x-default"] !== undefined,
      ),
    ).toBe(true);
  });
});

// 각 route가 공통 protocol에 올바른 사이트와 locale을 전달하는지 검증함.
describe("멀티사이트 metadata protocol", () => {
  it("세 사이트의 robots와 sitemap이 해당 origin을 사용함", async () => {
    const { GET: homeRobots } = await import("./(home)/home/robots.txt/route");
    const { GET: investRobots } =
      await import("./(invest)/invest/robots.txt/route");
    const { default: homeSitemap } = await import("./(home)/home/sitemap");
    for (const [origin, robots, sitemap] of [
      ["https://www.jamie.kr", homeRobots(), homeSitemap()],
      ["https://tech.jamie.kr", getRobots(), await techSitemap()],
      ["https://invest.jamie.kr", investRobots(), investSitemap()],
    ] as const) {
      expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
      expect(sitemap.length).toBeGreaterThan(0);
      expect(sitemap.every(({ url }) => new URL(url).origin === origin)).toBe(
        true,
      );
    }
  });
  it("두 RSS route가 locale과 site origin을 유지하고 잘못된 locale을 거부함", async () => {
    const { GET: techRss } =
      await import("./(tech)/tech/[locale]/rss.xml/route");
    const { GET: investRss } =
      await import("./(invest)/invest/[locale]/rss.xml/route");
    for (const [origin, handler] of [
      ["https://tech.jamie.kr", techRss],
      ["https://invest.jamie.kr", investRss],
    ] as const) {
      for (const locale of locales) {
        const response = await handler(
          new Request(`${origin}/${locale}/rss.xml`),
          { params: Promise.resolve({ locale }) },
        );
        const xml = await response.text();
        expect(xml).toContain(`<link>${origin}/${locale}</link>`);
        expect(xml).toContain(
          `<language>${locale === "ko" ? "ko-KR" : "en-US"}</language>`,
        );
        expect(xml).toContain(`<guid isPermaLink="true">${origin}/${locale}/`);
        expect(response.headers.get("Content-Type")).toBe(
          "application/rss+xml; charset=utf-8",
        );
      }
      const response = await handler(new Request(`${origin}/fr/rss.xml`), {
        params: Promise.resolve({ locale: "fr" }),
      });
      expect(response.status).toBe(404);
    }
  });
});
