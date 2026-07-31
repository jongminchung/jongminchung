import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-engineering-docs-locale",
    request.nextUrl.pathname.startsWith("/ko") ? "ko" : "en",
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/en/:path*", "/ko/:path*"],
};
