import { isLocale } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";

function escapeXml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
    return [{ locale: "ko" }, { locale: "en" }];
}

export async function GET(
    _request: Request,
    { params }: { readonly params: Promise<{ readonly locale: string }> },
): Promise<Response> {
    const { locale } = await params;
    if (!isLocale(locale)) return new Response("Not found", { status: 404 });
    const items = getLocalizedDocuments(locale)
        .filter(
            (document) =>
                document.section !== "overview" &&
                document.publicationStatus === "published",
        )
        .toSorted((left, right) =>
            right.publishedAt.localeCompare(left.publishedAt),
        )
        .map(
            (document) =>
                `<item><title>${escapeXml(document.title)}</title><link>https://tech.jamie.kr${document.href}</link><guid isPermaLink="true">https://tech.jamie.kr${document.href}</guid><description>${escapeXml(document.description)}</description><pubDate>${new Date(`${document.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`,
        )
        .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Engineering Notes</title><link>https://tech.jamie.kr/${locale}</link><description>Bilingual engineering articles</description><language>${locale === "ko" ? "ko-KR" : "en-US"}</language>${items}</channel></rss>`;
    return new Response(body, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
    });
}
