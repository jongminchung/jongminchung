import { isLocale } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { createRssResponse } from "#lib/rss";
import { siteOrigins } from "#lib/site-routing";

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
  return createRssResponse({
    origin: siteOrigins.tech,
    locale,
    title: "Engineering Notes",
    description: "Bilingual engineering articles",
    items: (await getLocalizedDocuments(locale)).toSorted((left, right) =>
      right.publishedAt.localeCompare(left.publishedAt),
    ),
  });
}
