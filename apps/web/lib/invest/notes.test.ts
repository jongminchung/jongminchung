import { describe, expect, it } from "vitest";
import {
  findInvestmentNote,
  getInvestmentNotes,
  getNotesBySource,
  loadInvestmentNote,
} from "./notes";

describe("투자 노트 Fumadocs 어댑터", () => {
  it("[성공] 게시 노트와 source별 노트를 조회함", async () => {
    const notes = await getInvestmentNotes("en");
    expect(notes.map(({ id }) => id)).toContain("latency-and-discipline");
    await expect(getNotesBySource("en", "article")).resolves.not.toHaveLength(
      0,
    );
  });

  it("[성공] 컴파일된 투자 노트 본문을 로드함", async () => {
    const note = await findInvestmentNote("en", "latency-and-discipline");
    expect(note?.id).toBe("latency-and-discipline");

    const loaded = await loadInvestmentNote("en", "latency-and-discipline");
    expect(loaded?.metadata).toBe(note);
    expect(loaded?.Content).toBeTypeOf("function");
    expect(loaded?.toc).toEqual([]);

    const article = await loadInvestmentNote(
      "en",
      "reading-the-13f-difference",
    );
    expect(article?.toc[0]?.url).toBe(
      "#start-by-limiting-what-a-13f-can-tell-us",
    );
  });

  it("[실패] 없는 투자 노트는 로드하지 않음", async () => {
    await expect(findInvestmentNote("en", "missing")).resolves.toBeNull();
    await expect(loadInvestmentNote("en", "missing")).resolves.toBeNull();
  });
});
