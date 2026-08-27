import { locales, type Locale } from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { getSeries, seriesRegistry } from "#lib/tech/series";

const siteOrigin = "https://tech.jamie.kr";
const absoluteUrl = (pathname: string): string =>
  new URL(pathname, siteOrigin).toString();
function documentLine(
  document: Awaited<ReturnType<typeof getLocalizedDocuments>>[number],
): string {
  const kind =
    document.documentKind === undefined
      ? ""
      : ` Type: ${document.documentKind};`;
  return `- [${document.title}](${absoluteUrl(document.href)}): ${document.description}${kind} Status: ${document.status}; published ${document.publishedAt}.`;
}

async function createLocaleSection(locale: Locale): Promise<readonly string[]> {
  const documents = await getLocalizedDocuments(locale);
  return [
    `## ${locale === "ko" ? "한국어 블로그" : "English blog"}`,
    "",
    ...documents.map(documentLine),
    "",
    `## ${locale === "ko" ? "시리즈" : "Series"}`,
    "",
    ...Object.keys(seriesRegistry).flatMap((id) => {
      const series = getSeries(id, locale);
      return series === null
        ? []
        : [
            `- [${series.title}](${absoluteUrl(`/${locale}/series/${id}`)}): ${series.description}`,
          ];
    }),
    "",
  ];
}

/** 요청에 대한 응답을 생성함 */
export async function GET(): Promise<Response> {
  const lines = [
    "# Engineering Notes",
    "",
    "> Bilingual engineering blog articles with optional ordered series.",
    "",
    "Korean and English articles share stable IDs. Prefer the language that matches the user's request.",
    "",
    ...(await Promise.all(locales.map(createLocaleSection))).flat(),
  ];
  return new Response(`${lines.join("\n").trimEnd()}\n`, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
