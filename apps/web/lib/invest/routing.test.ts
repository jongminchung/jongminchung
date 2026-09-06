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

  it("한글 시리즈 URL은 헤더에 안전하게 인코딩하고 중복 인코딩하지 않음", () => {
    const slug = "채권-투자";
    const href = `/ko/series/${encodeURIComponent(slug)}`;
    expect(createInvestmentSeriesHref("ko", "채권 투자")).toBe(href);
    expect(createInvestmentSeriesHref("ko", encodeURIComponent(slug))).toBe(
      href,
    );
    const response = Response.redirect(
      new URL(
        createInvestmentSeriesHref("ko", "채권 투자"),
        "https://invest.jamie.kr",
      ),
      308,
    );
    expect(response.headers.get("location")).toBe(
      `https://invest.jamie.kr${href}`,
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
