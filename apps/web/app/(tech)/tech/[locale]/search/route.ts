import { isLocale } from "#lib/content-model";
import { searchTechDocuments } from "#lib/tech/search-server";

/** locale 범위로 제한된 서버 검색 결과를 반환함 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/tech/[locale]/search">,
): Promise<Response> {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams.get("query") ?? "";
  return Response.json(await searchTechDocuments(query, locale));
}
