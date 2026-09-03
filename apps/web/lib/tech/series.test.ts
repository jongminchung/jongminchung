import { describe, expect, it } from "bun:test";
import { getSeries, isSeriesId } from "./series.ts";

describe("Blog Series registry", () => {
  it("등록된 Series를 locale별로 조회함", () => {
    expect(isSeriesId("building-from-first-principles")).toBe(true);
    expect(getSeries("react-ui-architecture", "ko")).toMatchObject({
      id: "react-ui-architecture",
      title: "React UI 설계",
      order: 1,
    });
  });

  it("등록되지 않은 Series를 거부함", () => {
    expect(isSeriesId("domain-driven-design")).toBe(false);
    expect(getSeries("domain-driven-design", "en")).toBeNull();
  });
});
