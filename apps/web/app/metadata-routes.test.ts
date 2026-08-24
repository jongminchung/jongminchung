import { describe, expect, it } from "vitest";
import { locales } from "../lib/content-model";
import { getDocuments } from "../lib/documents";
import { seriesRegistry } from "../lib/tech/series";
import { GET as getRobots } from "./(tech)/tech/robots.txt/route";
import sitemap from "./(tech)/tech/sitemap";

describe("블로그 메타데이터 경로", () => {
  it("[성공] 블로그, 글, 시리즈 URL만 사이트맵에 포함함", async () => {
    const [entries, documents] = await Promise.all([sitemap(), getDocuments()]);
    const urls = entries.map(({ url }) => url);
    for (const locale of locales) {
      expect(urls).toContain(`https://tech.jamie.kr/${locale}`);
      expect(urls).toContain(`https://tech.jamie.kr/${locale}/series`);
      for (const id of Object.keys(seriesRegistry))
        expect(urls).toContain(`https://tech.jamie.kr/${locale}/series/${id}`);
    }
    for (const document of documents)
      expect(urls).toContain(`https://tech.jamie.kr${document.href}`);
    expect(
      urls.some(
        (url) =>
          url.includes("/articles/") ||
          url.endsWith("/series/handbook") ||
          url.endsWith("/series/deep-dive"),
      ),
    ).toBe(false);
  });

  it("[성공] 생성된 사이트 맵을 크롤러에 게시함", async () => {
    expect(await getRobots().text()).toContain(
      "Sitemap: https://tech.jamie.kr/sitemap.xml",
    );
  });
});
