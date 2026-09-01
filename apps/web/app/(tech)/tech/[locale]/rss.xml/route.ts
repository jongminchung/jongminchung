import { isLocale } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { getLocaleProtocol } from "#lib/locale";
import { siteOrigins } from "#lib/site-routing";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  return [{ locale: "ko" }, { locale: "en" }];
}

/** 요청에 대한 응답을 생성함 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/tech/[locale]/rss.xml">,
): Promise<Response> {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const items = (await getLocalizedDocuments(locale))
    .toSorted((left, right) =>
      right.publishedAt.localeCompare(left.publishedAt),
    )
    .map(
      (document) =>
        `<item><title>${escapeXml(document.title)}</title><link>${siteOrigins.tech}${document.href}</link><guid isPermaLink="true">${siteOrigins.tech}${document.href}</guid><description>${escapeXml(document.description)}</description><pubDate>${new Date(`${document.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`,
    )
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Engineering Notes</title><link>${siteOrigins.tech}/${locale}</link><description>Bilingual engineering articles</description><language>${getLocaleProtocol(locale).rss}</language>${items}</channel></rss>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
