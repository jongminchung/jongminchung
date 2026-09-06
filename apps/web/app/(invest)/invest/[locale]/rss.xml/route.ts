import { getInvestmentNotes } from "#lib/invest/notes";
import { createRssResponse } from "#lib/rss";
import { isLocale, siteOrigins } from "#lib/site-routing";

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export function generateStaticParams() {
  return [{ locale: "ko" }, { locale: "en" }];
}

/** 요청에 대한 응답을 생성함 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/invest/[locale]/rss.xml">,
): Promise<Response> {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return createRssResponse({
    origin: siteOrigins.invest,
    locale,
    title: "Investment Notes",
    description: "Source-grounded investment research notes",
    items: getInvestmentNotes(locale),
  });
}
