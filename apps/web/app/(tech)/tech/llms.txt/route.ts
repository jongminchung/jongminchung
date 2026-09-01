import { displayTitleFor, locales, type Locale } from "#lib/content-model";
import { getBlogPosts, getDocsPages } from "#lib/documents";
import { siteOrigins } from "#lib/site-routing";
import { getTechMessages } from "#lib/tech/copy";
import { getDocsCategory } from "#lib/tech/docs";

const absoluteUrl = (pathname: string): string =>
  new URL(pathname, siteOrigins.tech).toString();

async function createLocaleSection(locale: Locale): Promise<readonly string[]> {
  const [posts, docs] = await Promise.all([getBlogPosts(), getDocsPages()]);
  const localizedPosts = posts.filter((post) => post.locale === locale);
  const localizedDocs = docs.filter((page) => page.locale === locale);
  const text = getTechMessages(locale).metadata;
  return [
    `## ${text.llmsBlog}`,
    "",
    ...localizedPosts.map(
      (post) =>
        `- [${displayTitleFor(post)}](${absoluteUrl(post.href)}): ${post.description} Status: ${post.status}; published ${post.publishedAt}.`,
    ),
    "",
    `## ${text.llmsDocs}`,
    "",
    ...localizedDocs.map((page) => {
      if (page.area === undefined || page.documentKind === undefined)
        return `- [${displayTitleFor(page)}](${absoluteUrl(page.href)}): Docs overview; ${page.description} Status: ${page.status}; verified ${page.verifiedAt}.`;
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
