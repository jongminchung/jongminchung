import { afterEach, describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function createRequest(
  pathname: string,
  {
    host = "tech.jamie.localhost:3000",
    headers = {},
  }: {
    readonly host?: string;
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): NextRequest {
  return new NextRequest(`http://${host}${pathname}`, {
    headers: { host, ...headers },
  });
}

describe("멀티사이트 proxy", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLocalSite = process.env.JAMIE_LOCAL_SITE;

  afterEach(() => {
    restoreEnvironmentVariable("NODE_ENV", originalNodeEnv);
    restoreEnvironmentVariable("JAMIE_LOCAL_SITE", originalLocalSite);
  });

  it("[성공] 루트 요청을 쿠키 우선·Accept-Language 차순으로 locale에 redirect함", () => {
    const saved = proxy(
      createRequest("/", {
        headers: {
          "accept-language": "ko-KR,ko;q=0.9",
          cookie: "tech-locale=en",
        },
      }),
    );
    expect(saved.status).toBe(307);
    expect(saved.headers.get("location")).toBe(
      "http://tech.jamie.localhost:3000/en",
    );
    expect(saved.headers.get("vary")).toBe("Cookie, Accept-Language");

    const negotiated = proxy(
      createRequest("/", {
        headers: {
          "accept-language": "fr, ko;q=0.8, en;q=0.5",
        },
      }),
    );
    expect(negotiated.headers.get("location")).toBe(
      "http://tech.jamie.localhost:3000/ko",
    );

    const production = proxy(
      createRequest("/", {
        headers: { "accept-language": "ko" },
        host: "jamie.kr",
      }),
    );
    expect(production.headers.get("location")).toBe("http://jamie.kr/ko");
  });

  it("[성공] 사이트 내부 경로로 rewrite하고 Content-Language를 설정함", () => {
    const response = proxy(createRequest("/ko/articles/ddd"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-language")).toBe("ko");
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://tech.jamie.localhost:3000/tech/ko/articles/ddd",
    );
    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
  });

  it("[성공] 개발 loopback 호스트를 선택한 사이트로 다시 작성함", () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.JAMIE_LOCAL_SITE = "invest";

    const response = proxy(createRequest("/en", { host: "localhost:3000" }));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/invest/en",
    );
  });

  it("[성공] Vercel 기본 hostname은 Tech preview로 제공함", () => {
    const response = proxy(
      createRequest("/ko", { host: "jongminchung-web-git-docs.vercel.app" }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://jongminchung-web-git-docs.vercel.app/tech/ko",
    );
  });

  it("[실패] 위조된 내부 헤더를 라우팅에 사용하지 않고 내부 경로 직접 접근을 차단함", () => {
    const headers = {
      "x-jamie-internal-rewrite": "1",
      "x-jamie-locale": "ko",
      "x-jamie-site": "tech",
    };
    for (const pathname of [
      "/sites/tech/ko",
      "/home/en",
      "/tech/ko",
      "/invest/en",
    ]) {
      expect(proxy(createRequest(pathname, { headers })).status).toBe(404);
    }
    expect(
      proxy(
        createRequest("/ko", {
          headers,
          host: "unknown.example",
        }),
      ).status,
    ).toBe(404);
  });

  it("[실패] X-Forwarded-Host를 신뢰하지 않고 호스트를 사용함", () => {
    expect(
      proxy(
        createRequest("/en", {
          headers: { "x-forwarded-host": "tech.jamie.kr" },
          host: "unknown.example",
        }),
      ).status,
    ).toBe(404);

    const response = proxy(
      createRequest("/en", {
        headers: { "x-forwarded-host": "unknown.example" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/tech/en");
  });
});

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
