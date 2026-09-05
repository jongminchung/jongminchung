import { Badge } from "@jongminchung/ui/components/badge";
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
import { getDocsPages } from "#lib/documents";
import { docsSource } from "#lib/fumadocs-source";
import { docsProseClassName } from "#lib/mdx-styles";
import { createDocsArticleStructuredData } from "#lib/structured-data";
import { getTechMessages } from "#lib/tech/copy";
import { getDocsCategory } from "#lib/tech/docs";
import {
  loadResolvedTechDocsPage,
  resolveTechDocsPage,
} from "#lib/tech/docs-page";
import { documentKindLabel } from "#lib/tech/document-kind";
import { techPageMetadata } from "#lib/tech/metadata";
import { publicPageTreeForArea } from "#lib/tech/publication";
import { docsMdxComponents } from "#mdx-components";
import { DocsLandingPage } from "#tech-components/DocsPortal";
import { DocsShell } from "#tech-components/DocsShell";
import {
  Arc42CoverageMap,
  C4ArchitectureMap,
  ObservabilityPipelineFlow,
  PlatformConvergenceFlow,
  TelemetryStorageLifecycle,
} from "#tech-components/PlatformArchitectureVisuals";
import { TechDocsMobileHeader } from "#tech-components/TechDocsMobileHeader";
import { TechDocsMobileToc } from "#tech-components/TechDocsMobileToc";
import { TechFumadocsProvider } from "#tech-components/TechFumadocsProvider";

const kindLabel: Readonly<Record<DocumentKind, string>> = {
  tutorial: "Tutorial",
  "how-to": "How-to",
  reference: "Reference",
  explanation: "Explanation",
};

const docsPageMdxComponents = {
  ...docsMdxComponents,
  Arc42CoverageMap,
  C4ArchitectureMap,
  ObservabilityPipelineFlow,
  PlatformConvergenceFlow,
  TelemetryStorageLifecycle,
};

function editHref(locale: Locale, slugs: readonly string[]): string {
  const path = slugs.length === 0 ? "index" : slugs.join("/");
  return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/docs/${locale}/${path}.mdx`;
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
}: PageProps<"/tech/[locale]/docs/[[...slug]]">) {
  const { locale, slug = [] } = await params;
  if (!isLocale(locale)) notFound();
  const model = await resolveTechDocsPage(locale, slug);
  if (model.kind === "not-found" || model.kind === "redirect") return {};
  const { page, alternatePage } = model;
  return techPageMetadata({
    title: displayTitleFor(page),
    description: page.description,
    locale,
    canonical: page.href,
    alternatePaths: {
      [locale]: page.href,
      [alternatePage.locale]: alternatePage.href,
    } as Record<Locale, string>,
    imageId: ["docs", ...slug].join("/"),
    article: page,
  });
}

/** Fumadocs DocsPage·TOC·page tree 이전/다음 탐색으로 문서를 렌더링함 */
export default async function TechDocsPage({
  params,
}: PageProps<"/tech/[locale]/docs/[[...slug]]">) {
  const { locale, slug = [] } = await params;
  if (!isLocale(locale)) notFound();
  const model = await resolveTechDocsPage(locale, slug);
  if (model.kind === "redirect") permanentRedirect(model.destination);
  if (model.kind === "not-found") notFound();
  if (model.kind === "landing") {
    return (
      <DocsShell
        active="docs"
        alternateHref={model.alternatePage.href}
        locale={locale}
      >
        <DocsLandingPage documents={model.documents} locale={locale} />
      </DocsShell>
    );
  }
  const document = await loadResolvedTechDocsPage(model);
  const { Content, metadata } = document;
  if (metadata.area === undefined || metadata.documentKind === undefined)
    notFound();
  const category = getDocsCategory(metadata.area, locale);
  const text = getTechMessages(locale).docs;
  const tree = publicPageTreeForArea(
    docsSource.getPageTree(locale),
    metadata.area,
    model.publicUrls,
  );
  return (
    <DocsShell
      active="docs"
      alternateHref={model.alternatePage.href}
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
              aria-label={text.breadcrumb}
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
              className={docsProseClassName(locale)}
              data-docs-prose="true"
              lang={locale}
            >
              <Content components={docsPageMdxComponents} />
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      </TechFumadocsProvider>
    </DocsShell>
  );
}
