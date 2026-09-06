import { describe, expect, it } from "bun:test";
import {
  createInternalSitePath,
  isSharedAssetPath,
  isVercelDeploymentHost,
  localeFromPath,
  localeCookieName,
  normalizeHost,
  parseLocalSiteOverride,
  resolveSite,
  selectLocale,
} from "./site-routing";

describe("멀티사이트 host와 locale 라우팅", () => {
  it.each([
    ["jamie.kr", "home"],
    ["www.jamie.kr", "home"],
    ["tech.jamie.kr", "tech"],
    ["invest.jamie.kr", "invest"],
    ["jamie.localhost:3000", "home"],
    ["tech.jamie.localhost:3000", "tech"],
    ["invest.jamie.localhost:3000", "invest"],
  ] as const)("[성공] %s을(를) %s에 매핑함", (host, site) => {
    expect(resolveSite(normalizeHost(host))).toBe(site);
  });

  it("[실패] host를 정규화하고 미등록 host를 거부함", () => {
    expect(normalizeHost("TECH.JAMIE.KR:443")).toBe("tech.jamie.kr");
    expect(
      resolveSite(normalizeHost("tech.jamie.kr, ingress.local")),
    ).toBeNull();
    expect(resolveSite("unknown.example")).toBeNull();
  });

  it("[성공] Vercel이 발급한 배포 hostname만 식별함", () => {
    expect(isVercelDeploymentHost("jongminchung-web.vercel.app")).toBe(true);
    expect(
      isVercelDeploymentHost("jongminchung-web-git-docs.vercel.app:443"),
    ).toBe(true);
    expect(isVercelDeploymentHost("vercel.app.example.com")).toBe(false);
    expect(isVercelDeploymentHost("tech.jamie.kr")).toBe(false);
  });

  it("[성공] 개발 loopback 호스트만 선택한 사이트로 재정의함", () => {
    expect(resolveSite("localhost", "tech")).toBe("tech");
    expect(resolveSite("127.0.0.1", "invest")).toBe("invest");
    expect(resolveSite(normalizeHost("[::1]:3000"), "tech")).toBe("tech");
    expect(resolveSite("tech.jamie.localhost", "invest")).toBe("tech");
    expect(resolveSite("jamie.kr", "invest")).toBe("home");
    expect(resolveSite("www.jamie.kr", "invest")).toBe("home");
    expect(resolveSite("unknown.example", "tech")).toBeNull();
  });

  it("[실패] 개발 환경 외부와 잘못된 사이트 선택값을 거부함", () => {
    expect(parseLocalSiteOverride("production", "tech")).toBeNull();
    expect(parseLocalSiteOverride("test", "tech")).toBeNull();
    expect(parseLocalSiteOverride("development", undefined)).toBeNull();
    expect(parseLocalSiteOverride("development", "invest")).toBe("invest");
    expect(() => parseLocalSiteOverride("development", "docs")).toThrow(
      /JAMIE_LOCAL_SITE/u,
    );
  });

  it("[성공] 공개 pathname 앞에 사이트 내부 prefix를 붙임", () => {
    expect(createInternalSitePath("home", "/")).toBe("/home");
    expect(createInternalSitePath("tech", "/ko/articles/modeling")).toBe(
      "/tech/ko/articles/modeling",
    );
  });

  it("[성공] 저장된 locale을 브라우저 언어보다 우선함", () => {
    expect(selectLocale("en", "ko-KR,ko;q=0.9")).toBe("en");
    expect(selectLocale("invalid", "ko-KR,ko;q=0.9")).toBe("ko");
  });

  it("[성공] Accept-Language의 품질값과 입력 순서로 지원 언어를 선택함", () => {
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

  it("[성공] URL의 locale과 사이트별 locale 쿠키 이름을 반환함", () => {
    expect(localeFromPath("/ko/articles/modeling")).toBe("ko");
    expect(localeFromPath("/articles/modeling")).toBeNull();
    expect(localeCookieName("invest")).toBe("invest-locale");
  });

  it("[성공] 공용 font stylesheet와 source를 site rewrite에서 제외함", () => {
    expect(
      isSharedAssetPath("/fonts/pretendard-variable/dynamic-subset.css"),
    ).toBe(true);
    expect(
      isSharedAssetPath(
        "/fonts/pretendard-variable/PretendardVariable.subset.91.woff2",
      ),
    ).toBe(true);
  });
});
