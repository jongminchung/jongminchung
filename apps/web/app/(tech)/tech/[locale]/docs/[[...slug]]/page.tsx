import { Badge } from "@jongminchung/ui/components/badge";
import { cn } from "@jongminchung/ui/lib/utils";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { StructuredData } from "#components/StructuredData";
import {
  displayTitleFor,
  isLocale,
  type DocumentKind,
  type Locale,
} from "#lib/content-model";
import {
  findBlogPost,
  findDocsPage,
  getDocsPages,
  loadDocsPage,
} from "#lib/documents";
import { docsSource } from "#lib/fumadocs-source";
import { createDocsArticleStructuredData } from "#lib/structured-data";
import {
  docsCategoryIds,
  getDocsCategory,
  isDocsCategoryId,
} from "#lib/tech/docs";
import { documentKindLabel } from "#lib/tech/document-kind";
import { techPageMetadata } from "#lib/tech/metadata";
import { publicPageTreeForArea } from "#lib/tech/publication";
import { mdxComponents } from "#mdx-components";
import { DocsLandingPage } from "#tech-components/DocsPortal";
import { DocsShell } from "#tech-components/DocsShell";
import { TechDocsMobileHeader } from "#tech-components/TechDocsMobileHeader";
import { TechDocsMobileToc } from "#tech-components/TechDocsMobileToc";
import { TechFumadocsProvider } from "#tech-components/TechFumadocsProvider";

const kindLabel: Readonly<Record<DocumentKind, string>> = {
  tutorial: "Tutorial",
  "how-to": "How-to",
  reference: "Reference",
  explanation: "Explanation",
};

function otherLocale(locale: Locale): Locale {
  return locale === "ko" ? "en" : "ko";
}

function editHref(locale: Locale, slugs: readonly string[]): string {
  const path = slugs.length === 0 ? "index" : slugs.join("/");
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/docs/${locale}/${path}.mdx`;
}

function legacyDocsDestination(
  locale: Locale,
  slugs: readonly string[],
): string | null {
  const [area, ...rest] = slugs;
  if (area === "architecture")
    return `/${locale}/docs/be${rest.length === 0 ? "" : `/${rest.join("/")}`}`;
  if (area === "tooling")
    return `/${locale}/docs/fe${rest.length === 0 ? "" : `/${rest.join("/")}`}`;
  if (area === "practices" && rest.length === 0) return `/${locale}/docs/be`;
  if (area === "practices" && rest.length === 1 && rest[0] === "collaboration")
    return `/${locale}/docs/be/collaboration`;
  return null;
}

/** Docs page tree의 모든 canonical 경로를 정적으로 생성함 */
export async function generateStaticParams() {
  return (await getDocsPages()).map((page) => ({
    locale: page.locale,
    slug: [...page.slugs],
  }));
}

/** Docs canonical·hreflang·TechArticle 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: string[];
  }>;
}) {
  const { locale, slug = [] } = await params;
  if (!isLocale(locale)) notFound();
  const page = await findDocsPage(locale, slug);
  if (page === null) return {};
  const alternatePage = await findDocsPage(otherLocale(locale), slug);
  if (alternatePage === null)
    throw new Error(`Missing localized Docs counterpart for ${page.href}.`);
  return techPageMetadata({
    title: displayTitleFor(page),
    description: page.description,
    locale,
    canonical: page.href,
    alternatePaths: {
      [locale]: page.href,
      [otherLocale(locale)]: alternatePage.href,
    } as Record<Locale, string>,
    imageId: ["docs", ...slug].join("/"),
    article: page,
  });
}

/** Fumadocs DocsPage·TOC·page tree 이전/다음 탐색으로 문서를 렌더링함 */
export default async function TechDocsPage({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly slug?: string[];
  }>;
}) {
  const { locale, slug = [] } = await params;
  if (!isLocale(locale)) notFound();
  if (
    ["architecture", "tooling", "practices"].includes(slug[0] ?? "") &&
    slug.length === 2 &&
    slug[1] !== undefined
  ) {
    const id = slug[1];
    const [moved, blog] = await Promise.all([
      getDocsPages().then((pages) =>
        pages.find((page) => page.locale === locale && page.id === id),
      ),
      findBlogPost(locale, id),
    ]);
    if (moved !== undefined) permanentRedirect(moved.href);
    if (blog !== null) permanentRedirect(blog.href);
  }
  const legacyDestination = legacyDocsDestination(locale, slug);
  if (legacyDestination !== null) permanentRedirect(legacyDestination);
  const document = await loadDocsPage(locale, slug);
  if (document === null) {
    const id = slug.at(-1);
    if (id !== undefined) {
      const [movedDocs, blog] = await Promise.all([
        getDocsPages().then((pages) =>
          pages.find((page) => page.locale === locale && page.id === id),
        ),
        findBlogPost(locale, id),
      ]);
      if (movedDocs !== undefined) permanentRedirect(movedDocs.href);
      if (blog !== null) permanentRedirect(blog.href);
    }
    notFound();
  }

  const { Content, metadata } = document;
  const alternate = otherLocale(locale);
  if (slug.length === 0) {
    const documents = (await getDocsPages()).filter(
      (page) => page.locale === locale && page.area !== undefined,
    );
    return (
      <DocsShell
        active="docs"
        alternateHref={`/${alternate}/docs`}
        locale={locale}
      >
        <DocsLandingPage documents={documents} locale={locale} />
      </DocsShell>
    );
  }
  const area = slug[0];
  if (
    area === undefined ||
    !isDocsCategoryId(area) ||
    !docsCategoryIds.includes(area as (typeof docsCategoryIds)[number]) ||
    metadata.area === undefined ||
    metadata.documentKind === undefined
  )
    notFound();
  const category = getDocsCategory(metadata.area, locale);
  const text =
    locale === "ko"
      ? {
          updated: "업데이트",
          verified: "검증",
          source: "근거 자료",
          edit: "이 페이지 편집",
        }
      : {
          updated: "Updated",
          verified: "Verified",
          source: "Source",
          edit: "Edit this page",
        };
  const publicUrls = new Set(
    (await getDocsPages())
      .filter((page) => page.locale === locale && page.area === metadata.area)
      .map((page) => page.href),
  );
  const tree = publicPageTreeForArea(
    docsSource.getPageTree(locale),
    metadata.area,
    publicUrls,
  );
  return (
    <DocsShell
      active="docs"
      alternateHref={`/${alternate}/docs/${slug.join("/")}`}
      docsCategory={metadata.area}
      locale={locale}
    >
      <TechFumadocsProvider>
        <DocsLayout
          nav={{ enabled: false }}
          searchToggle={{ enabled: false }}
          sidebar={{ defaultOpenLevel: 1 }}
          tabs={false}
          themeSwitch={{ enabled: false }}
          tree={tree}
        >
          <StructuredData value={createDocsArticleStructuredData(metadata)} />
          <TechDocsMobileHeader locale={locale} />
          <TechDocsMobileToc locale={locale} toc={document.toc} />
          <DocsPage
            className="px-5 pt-10 pb-20 md:px-8"
            tableOfContentPopover={{ enabled: false }}
            toc={[...document.toc]}
          >
            <nav
              aria-label={locale === "ko" ? "현재 위치" : "Breadcrumb"}
              className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
            >
              <Link href={`/${locale}/docs`}>Docs</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/${locale}/docs/${metadata.area}`}>
                {category.title}
              </Link>
              <span aria-hidden="true">/</span>
              <span>{documentKindLabel(locale, metadata.documentKind)}</span>
            </nav>
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {kindLabel[metadata.documentKind]}
              </Badge>
              <Badge variant="outline">{category.title}</Badge>
            </div>
            <DocsTitle className="tracking-[-.04em] text-balance">
              {displayTitleFor(metadata)}
            </DocsTitle>
            <DocsDescription>{metadata.description}</DocsDescription>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-7 text-sm text-muted-foreground">
              <span>
                {text.updated}{" "}
                <time dateTime={metadata.updatedAt}>{metadata.updatedAt}</time>
              </span>
              <span>
                {text.verified}{" "}
                <time dateTime={metadata.verifiedAt}>
                  {metadata.verifiedAt}
                </time>
              </span>
              <a href={metadata.sourceUrl} rel="noreferrer" target="_blank">
                {text.source}
              </a>
              <Link href={editHref(locale, metadata.slugs)}>{text.edit}</Link>
            </div>
            <DocsBody
              className={cn(
                "mt-8 text-base leading-[1.65] tracking-[-.01em] break-words",
                "[&_code:not(pre_code)]:rounded-[var(--radius-xs)] [&_code:not(pre_code)]:bg-accent/55 [&_code:not(pre_code)]:px-[.3rem] [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[.875rem] [&_code:not(pre_code)]:text-primary",
                "[&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5",
              )}
              data-docs-prose="true"
              lang={locale}
            >
              <Content components={mdxComponents} />
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      </TechFumadocsProvider>
    </DocsShell>
  );
}
