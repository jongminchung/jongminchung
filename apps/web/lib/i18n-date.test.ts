import { describe, expect, it } from "bun:test";
import { formatEditorialDate } from "./i18n-date";

describe("formatEditorialDate", () => {
  it("ISO 날짜를 한국어와 영어 표기로 현지화함", () => {
    expect(formatEditorialDate("ko", "2026-07-10")).toBe("2026. 7. 10.");
    expect(formatEditorialDate("en", "2026-07-10")).toBe("Jul 10, 2026");
  });
});
