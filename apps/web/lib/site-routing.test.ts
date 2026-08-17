import { describe, expect, it } from "vitest";
import {
    createInternalSitePath,
    localeFromPath,
    localeCookieName,
    normalizeHost,
    resolveSite,
    selectLocale,
} from "./site-routing";

describe("multi-domain site routing", () => {
    it.each([
        ["jamie.kr", "home"],
        ["tech.jamie.kr", "tech"],
        ["invest.jamie.kr", "invest"],
        ["jamie.localhost:3000", "home"],
        ["tech.jamie.localhost:3000", "tech"],
        ["invest.jamie.localhost:3000", "invest"],
    ] as const)("maps %s to %s", (host, site) => {
        expect(resolveSite(normalizeHost(host))).toBe(site);
    });

    it("normalizes standard Host values and rejects unknown hosts", () => {
        expect(normalizeHost("TECH.JAMIE.KR:443")).toBe("tech.jamie.kr");
        expect(
            resolveSite(normalizeHost("tech.jamie.kr, ingress.local")),
        ).toBeNull();
        expect(resolveSite("unknown.example")).toBeNull();
    });

    it("creates private internal paths without exposing them publicly", () => {
        expect(createInternalSitePath("home", "/")).toBe("/sites/home");
        expect(createInternalSitePath("tech", "/ko/articles/modeling")).toBe(
            "/sites/tech/ko/articles/modeling",
        );
    });

    it("selects the saved locale before the browser preference", () => {
        expect(selectLocale("en", "ko-KR,ko;q=0.9")).toBe("en");
        expect(selectLocale("invalid", "ko-KR,ko;q=0.9")).toBe("ko");
    });

    it("negotiates supported Accept-Language values by quality and order", () => {
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

    it("derives the selected locale from the public URL", () => {
        expect(localeFromPath("/ko/articles/modeling")).toBe("ko");
        expect(localeFromPath("/articles/modeling")).toBeNull();
        expect(localeCookieName("invest")).toBe("invest-locale");
    });
});
