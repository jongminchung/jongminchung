import { displayTitleFor, locales, type Locale } from "#lib/content-model";
import { getBlogPosts, getDocsPages } from "#lib/documents";
import { getDocsCategory } from "#lib/tech/docs";

const siteOrigin = "https://tech.jamie.kr";
const absoluteUrl = (pathname: string): string =>
  new URL(pathname, siteOrigin).toString();

async function createLocaleSection(locale: Locale): Promise<readonly string[]> {
  const [posts, docs] = await Promise.all([getBlogPosts(), getDocsPages()]);
  const localizedPosts = posts.filter((post) => post.locale === locale);
  const localizedDocs = docs.filter((page) => page.locale === locale);
  return [
    `## ${locale === "ko" ? "한국어 Blog" : "English Blog"}`,
    "",
    ...localizedPosts.map(
      (post) =>
        `- [${displayTitleFor(post)}](${absoluteUrl(post.href)}): ${post.description} Status: ${post.status}; published ${post.publishedAt}.`,
    ),
    "",
    `## ${locale === "ko" ? "한국어 Docs" : "English Docs"}`,
    "",
    ...localizedDocs.map((page) => {
      const area = getDocsCategory(page.area, locale);
      return `- [${displayTitleFor(page)}](${absoluteUrl(page.href)}): Area: ${area.title}; Type: ${page.documentKind}; ${page.description} Status: ${page.status}; verified ${page.verifiedAt}.`;
    }),
    "",
  ];
}

/** Blog와 Docs canonical을 분리된 section으로 출력함 */
export async function GET(): Promise<Response> {
  const lines = [
    "# Engineering Notes",
    "",
    "> Bilingual engineering Blog articles and Diátaxis-oriented Docs.",
    "",
    "Korean and English content shares stable IDs. Prefer the language that matches the user's request.",
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
