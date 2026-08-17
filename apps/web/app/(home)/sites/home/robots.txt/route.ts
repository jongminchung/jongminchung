export const dynamic = "force-static";

export function GET(): Response {
    return new Response(
        "User-agent: *\nAllow: /\nSitemap: https://jamie.kr/sitemap.xml\n",
        {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
    );
}
