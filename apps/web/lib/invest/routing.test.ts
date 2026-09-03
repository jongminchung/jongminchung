import { describe, expect, it } from "bun:test";
import {
  createInvestmentSeriesHref,
  createInvestmentSourceHref,
  createInvestmentTagHref,
  investmentSeriesSlug,
  sourceDescription,
  sourceTitle,
} from "./routing";

describe("투자 collection 라우팅", () => {
  it("[성공] 표시용 series 이름을 안정적인 URL로 변환함", () => {
    expect(investmentSeriesSlug("Operating notes")).toBe("operating-notes");
    expect(investmentSeriesSlug("Operating%20notes")).toBe("operating-notes");
    expect(createInvestmentSeriesHref("ko", "Operating notes")).toBe(
      "/ko/series/operating-notes",
    );
  });

  it("[성공] tag와 source URL을 locale별로 생성함", () => {
    expect(createInvestmentTagHref("en", "capital-allocation")).toBe(
      "/en/tags/capital-allocation",
    );
    expect(createInvestmentSourceHref("ko", "article")).toBe(
      "/ko/sources/article",
    );
  });

  it("[성공] source 제목과 검색 설명을 지역화함", () => {
    expect(sourceTitle("ko", "book")).toBe("책");
    expect(sourceDescription("en", "video")).toContain("videos");
  });
});
