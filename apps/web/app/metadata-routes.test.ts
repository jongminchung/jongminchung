import { describe, expect, it } from "vitest";
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
