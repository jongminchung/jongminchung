import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
    createInternalSitePath,
    isSharedAssetPath,
    localeCookieName,
    localeFromPath,
    normalizeHost,
    resolveSite,
    selectLocale,
    siteIds,
} from "#lib/site-routing";

/** `proxy` 공개 기능을 제공함 */
export function proxy(request: NextRequest): NextResponse {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/healthz" || isSharedAssetPath(pathname)) {
        return NextResponse.next();
    }
    if (
        pathname === "/sites" ||
        pathname.startsWith("/sites/") ||
        siteIds.some(
            (site) =>
                pathname === `/${site}` || pathname.startsWith(`/${site}/`),
        )
    ) {
        return new NextResponse(null, { status: 404 });
    }

    const requestHost = request.headers.get("host") ?? "";
    const host = normalizeHost(requestHost);
    const site = resolveSite(host);
    if (site === null) return new NextResponse(null, { status: 404 });

    if (pathname === "/") {
        const locale = selectLocale(
            request.cookies.get(localeCookieName(site))?.value,
            request.headers.get("accept-language"),
        );
        const destination = request.nextUrl.clone();
        const requestedPort = /:(\d+)$/u.exec(requestHost)?.[1] ?? "";
        destination.hostname = host;
        destination.port = requestedPort;
        destination.pathname = `/${locale}`;
        const response = NextResponse.redirect(destination, 307);
        response.headers.set("Cache-Control", "private, no-cache");
        response.headers.set("Vary", "Cookie, Accept-Language");
        return response;
    }

    const locale = localeFromPath(pathname);

    const destination = request.nextUrl.clone();
    destination.pathname = createInternalSitePath(site, pathname);
    const response = NextResponse.rewrite(destination);
    if (locale !== null) {
        response.headers.set("Content-Language", locale);
        response.cookies.set(localeCookieName(site), locale, {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 365,
            path: "/",
            sameSite: "lax",
            secure:
                host !== "localhost" &&
                !host.endsWith(".localhost") &&
                host !== "127.0.0.1",
        });
    }
    return response;
}

export const config = {
    matcher: ["/:path*"],
};
