import { describe, expect, it } from "bun:test";
import { alternateLocale, getLocaleProtocol } from "./locale";

describe("locale protocol mapping", () => {
  it.each([
    ["ko", "en", "ko_KR", "ko-KR"],
    ["en", "ko", "en_US", "en-US"],
  ] as const)(
    "[성공] %s locale의 UI·Open Graph·RSS protocol 값을 구분함",
    (locale, alternate, openGraph, rss) => {
      expect(alternateLocale(locale)).toBe(alternate);
      expect(getLocaleProtocol(locale)).toEqual({
        alternate,
        openGraph,
        rss,
      });
    },
  );
});
