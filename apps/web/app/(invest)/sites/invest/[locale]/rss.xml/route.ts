import { getInvestmentNotes } from "#lib/investment-notes";
import { isLocale } from "#lib/site-routing";

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
/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
    return [{ locale: "ko" }, { locale: "en" }];
}

/** 요청에 대한 응답을 생성함 */
export async function GET(
    _request: Request,
    { params }: { readonly params: Promise<{ readonly locale: string }> },
): Promise<Response> {
    const { locale } = await params;
    if (!isLocale(locale)) return new Response("Not found", { status: 404 });
    const items = (await getInvestmentNotes(locale))
        .map(
            (note) =>
                `<item><title>${escapeXml(note.title)}</title><link>https://invest.jamie.kr${note.href}</link><guid isPermaLink="true">https://invest.jamie.kr${note.href}</guid><description>${escapeXml(note.description)}</description><pubDate>${new Date(`${note.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`,
        )
        .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Investment Notes</title><link>https://invest.jamie.kr/${locale}</link><description>Source-grounded investment research notes</description><language>${locale === "ko" ? "ko-KR" : "en-US"}</language>${items}</channel></rss>`;
    return new Response(body, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
    });
}
