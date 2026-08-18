import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
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

describe("제조원", () => {
    it("[성공] 쿠키 및 Accept-Language를 통해 사이트를 종료함", () => {
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

    it("[성공] 지역적으로 다시 작성하고 표현적인 언어를 선언함", () => {
        const response = proxy(createRequest("/ko/articles/ddd"));
        expect(response.status).toBe(200);
        expect(response.headers.get("content-language")).toBe("ko");
        expect(response.headers.get("x-middleware-rewrite")).toBe(
            "http://tech.jamie.localhost:3000/tech/ko/articles/ddd",
        );
        expect(
            response.headers.get("x-middleware-override-headers"),
        ).toBeNull();
    });

    it("[실패] 스푸핑된 내부 헤더 및 개인 위치를 유지함", () => {
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
            expect(proxy(createRequest(pathname, { headers })).status).toBe(
                404,
            );
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
        expect(response.headers.get("x-middleware-rewrite")).toContain(
            "/tech/en",
        );
    });
});
