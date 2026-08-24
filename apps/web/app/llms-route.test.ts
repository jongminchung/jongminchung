import { describe, expect, it } from "vitest";
import { getDocuments } from "../lib/documents";
import { seriesRegistry } from "../lib/tech/series";
import { GET } from "./(tech)/tech/llms.txt/route";

describe("llms.txt", () => {
  it("[성공] 모든 블로그 글과 시리즈를 새 URL로 게시함", async () => {
    const response = await GET();
    const body = await response.text();
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(body).toMatch(/^# Engineering Notes\n\n> /u);
    for (const document of await getDocuments())
      expect(body).toContain(`](https://tech.jamie.kr${document.href})`);
    for (const id of Object.keys(seriesRegistry)) {
      expect(body).toContain(`/ko/series/${id}`);
      expect(body).toContain(`/en/series/${id}`);
    }
    expect(body).not.toContain("/articles/");
  });
});
