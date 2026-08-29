import { notFound, permanentRedirect } from "next/navigation";
import {
  createBlogPostHref,
  displayTitleFor,
  isLocale,
} from "#lib/content-model";
import { findBlogPost, getDocsPages, loadBlogPost } from "#lib/documents";
import { alternateLocale } from "#lib/locale";
import { techPageMetadata } from "#lib/tech/metadata";
import { DocsShell } from "#tech-components/DocsShell";
import { DocumentPage } from "#tech-components/DocumentPage";

export const instant = false;

/** Blog 글과 과거 Docs canonical을 정적으로 열거함 */
export async function generateStaticParams() {
  const posts = await import("#lib/documents").then(({ getBlogPosts }) =>
    getBlogPosts(),
  );
  return posts.map(({ locale, id }) => ({ locale, slug: id }));
}

/** BlogPosting 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug: string;
  }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const post = await findBlogPost(locale, slug);
  if (post === null) return {};
  return techPageMetadata({
    title: displayTitleFor(post),
    description: post.description,
    locale,
    canonical: post.href,
    alternatePaths: {
      ko: createBlogPostHref("ko", post.id),
      en: createBlogPostHref("en", post.id),
    },
    imageId: post.id,
    article: post,
  });
}

/** Blog 글을 렌더링하고 이관된 과거 URL을 한 번의 308로 연결함 */
export default async function BlogArticlePage({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug: string;
  }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const document = await loadBlogPost(locale, slug);
  if (document === null) {
    const moved = (await getDocsPages()).find(
      (page) => page.locale === locale && page.id === slug,
    );
    if (moved !== undefined) permanentRedirect(moved.href);
    notFound();
  }
  const alternate = alternateLocale(locale);
  return (
    <DocsShell
      alternateHref={createBlogPostHref(alternate, document.metadata.id)}
      locale={locale}
    >
      <DocumentPage document={document} locale={locale} />
    </DocsShell>
  );
}
