import { isLocale } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import {
  filterEditorialItems,
  paginateEditorialItems,
  parseEditorialQuery,
} from "#lib/editorial";
import { toTechEditorialItem } from "#lib/editorial-adapters";

/** 무한 스크롤에 필요한 한 페이지의 공개 글만 반환함. */
export async function GET(
  request: Request,
  { params }: RouteContext<"/tech/[locale]/articles">,
): Promise<Response> {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const items = (await getLocalizedDocuments(locale)).map((document) =>
    toTechEditorialItem(document, locale),
  );
  const searchParams = new URL(request.url).searchParams;
  const query = parseEditorialQuery(
    Object.fromEntries(
      ["tag", "sort", "view", "page"].map((key) => [
        key,
        searchParams.get(key) ?? undefined,
      ]),
    ),
    items.flatMap((item) => item.tags),
  );
  const page = paginateEditorialItems(
    filterEditorialItems(items, query),
    query.page,
  );
  return Response.json(page);
}
