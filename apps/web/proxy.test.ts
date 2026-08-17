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

describe("multi-domain proxy", () => {
    it("redirects the site root by cookie and Accept-Language", () => {
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

    it("rewrites localized routes and declares the representation language", () => {
        const response = proxy(createRequest("/ko/articles/ddd"));
        expect(response.status).toBe(200);
        expect(response.headers.get("content-language")).toBe("ko");
        expect(response.headers.get("x-middleware-rewrite")).toBe(
            "http://tech.jamie.localhost:3000/sites/tech/ko/articles/ddd",
        );
        expect(
            response.headers.get("x-middleware-override-headers"),
        ).toBeNull();
    });

    it("rejects spoofed internal routing headers and private paths", () => {
        const headers = {
            "x-jamie-internal-rewrite": "1",
            "x-jamie-locale": "ko",
            "x-jamie-site": "tech",
        };
        expect(proxy(createRequest("/sites/tech/ko", { headers })).status).toBe(
            404,
        );
        expect(
            proxy(
                createRequest("/ko", {
                    headers,
                    host: "unknown.example",
                }),
            ).status,
        ).toBe(404);
    });

    it("uses Host without trusting X-Forwarded-Host", () => {
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
            "/sites/tech/en",
        );
    });
});
