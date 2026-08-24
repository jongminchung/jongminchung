import { describe, expect, it } from "vitest";
import {
  createInternalSitePath,
  localeFromPath,
  localeCookieName,
  normalizeHost,
  resolveSite,
  selectLocale,
} from "./site-routing";

describe("여러 개의 사이트에 속해 있음", () => {
  it.each([
    ["jamie.kr", "home"],
    ["tech.jamie.kr", "tech"],
    ["invest.jamie.kr", "invest"],
    ["jamie.localhost:3000", "home"],
    ["tech.jamie.localhost:3000", "tech"],
    ["invest.jamie.localhost:3000", "invest"],
  ] as const)("[성공] %s을(를) %s에 매핑함", (host, site) => {
    expect(resolveSite(normalizeHost(host))).toBe(site);
  });

  it("[실패] 표준 호스트 값을 정규화하고 알 수 없는 호스트가 있음", () => {
    expect(normalizeHost("TECH.JAMIE.KR:443")).toBe("tech.jamie.kr");
    expect(
      resolveSite(normalizeHost("tech.jamie.kr, ingress.local")),
    ).toBeNull();
    expect(resolveSite("unknown.example")).toBeNull();
  });

  it("[실패] 표시되지 않고 외부 외부를 생성함", () => {
    expect(createInternalSitePath("home", "/")).toBe("/home");
    expect(createInternalSitePath("tech", "/ko/articles/modeling")).toBe(
      "/tech/ko/articles/modeling",
    );
  });

  it("[성공] 브라우저의 기본 설정은 저장되어 있음", () => {
    expect(selectLocale("en", "ko-KR,ko;q=0.9")).toBe("en");
    expect(selectLocale("invalid", "ko-KR,ko;q=0.9")).toBe("ko");
  });

  it("[성공] 품질과 시간에 따라 지원되는 Accept-Language 값을 계약함", () => {
    expect(selectLocale(undefined, "ko-KR,ko;q=0.9")).toBe("ko");
    expect(selectLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(selectLocale(undefined, "fr, ko;q=0.8, en;q=0.5")).toBe("ko");
    expect(selectLocale(undefined, "en;q=0.5, ko;q=0.9")).toBe("ko");
    expect(selectLocale(undefined, "en;q=0.8, ko;q=0.8")).toBe("en");
    expect(selectLocale(undefined, "ko;q=0, en;q=0.5")).toBe("en");
    expect(selectLocale(undefined, "ko;q=invalid, en;q=0.5")).toBe("en");
    expect(selectLocale(undefined, "fr-FR, *;q=0.5")).toBe("en");
    expect(selectLocale(undefined, null)).toBe("en");
  });

  it("[성공] 경고 URL에서 제외 로케일을 파생함", () => {
    expect(localeFromPath("/ko/articles/modeling")).toBe("ko");
    expect(localeFromPath("/articles/modeling")).toBeNull();
    expect(localeCookieName("invest")).toBe("invest-locale");
  });
});
