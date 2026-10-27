import { describe, expect, it } from "vite-plus/test";
import {
  getInvestmentMessages,
  investmentSeriesDescription,
  investmentTagDescription,
} from "./copy.ts";

describe("Invest locale copy", () => {
  it("각 언어의 탐색 문구와 페이지 수를 표시함", () => {
    expect(getInvestmentMessages("ko").layout.navigation).toBe(
      "투자 콘텐츠 탐색",
    );
    expect(getInvestmentMessages("en").layout.navigation).toBe(
      "Investment content navigation",
    );
    expect(getInvestmentMessages("ko").index.pageLabel(2, 5)).toBe(
      "2 / 5 페이지",
    );
    expect(getInvestmentMessages("en").index.pageLabel(2, 5)).toBe(
      "Page 2 of 5",
    );
  });

  it("대표 시리즈와 일반 시리즈 설명을 현지화함", () => {
    const series = "Financial Statements to Stock Valuation";
    expect(investmentSeriesDescription("ko", series)).toContain("총 12편");
    expect(investmentSeriesDescription("en", series)).toContain(
      "Twelve chapters",
    );
    expect(investmentSeriesDescription("ko", "Value")).toContain("Value");
    expect(investmentSeriesDescription("en", "Value")).toContain("Value");
    expect(investmentTagDescription("ko", "Risk")).toContain("Risk");
    expect(investmentTagDescription("en", "Risk")).toContain("Risk");
  });
});
