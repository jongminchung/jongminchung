import { describe, expect, it } from "vitest";
import { getDocuments } from "../lib/documents";
import { GET } from "./(tech)/tech/llms.txt/route";

describe("llms.txt", () => {
  it("[성공] 모든 Blog와 Docs canonical을 분리된 section으로 게시함", async () => {
    const response = await GET();
    const body = await response.text();
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(body).toMatch(/^# Engineering Notes\n\n> /u);
    for (const document of await getDocuments())
      expect(body).toContain(`](https://tech.jamie.kr${document.href})`);
    expect(body).toContain("## 한국어 Blog");
    expect(body).toContain("## English Docs");
    expect(body).not.toContain("/series/");
    expect(body).not.toContain("/articles/");
  });
});
