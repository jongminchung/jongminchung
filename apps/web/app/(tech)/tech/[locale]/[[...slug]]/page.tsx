import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  createDocHref,
  createOgImageHref,
  createSeriesHref,
  isLocale,
  locales,
  type Locale,
} from "#lib/content-model";
import {
  findDocument,
  getLocalizedDocuments,
  loadDocument,
} from "#lib/documents";
import {
  createDocsHref,
  docsCategoryIds,
  documentsForDocsCategory,
  getDocsCategory,
  isDocsCategoryId,
} from "#lib/tech/docs";
import {
  getSeries,
  isSeriesId,
  seriesRegistry,
  type SeriesId,
} from "#lib/tech/series";
import { BlogIndex } from "#tech-components/BlogIndex";
import {
  DocsArticlePage,
  DocsCategoryPage,
  DocsLandingPage,
} from "#tech-components/DocsPortal";
import { DocsShell } from "#tech-components/DocsShell";
import { DocumentPage } from "#tech-components/DocumentPage";
import { SeriesDetail, SeriesIndex } from "#tech-components/SeriesPages";
import { ShowcasePage } from "#tech-components/ShowcasePage";

interface StaticPageParam {
  readonly locale: string;
  readonly slug: readonly string[];
}
export const instant = false;

function otherLocale(locale: Locale): Locale {
  return locale === "ko" ? "en" : "ko";
}

function metadata({
  title,
  description,
  locale,
  canonical,
  alternatePaths,
  imageId,
  type = "website",
}: {
  readonly title: string;
  readonly description: string;
  readonly locale: Locale;
  readonly canonical: string;
  readonly alternatePaths: Record<Locale, string>;
  readonly imageId: string;
  readonly type?: "article" | "website";
}): Metadata {
  const image = {
    url: createOgImageHref(locale, imageId),
    width: 1200,
    height: 630,
    alt: `${title} · Engineering Notes`,
  };
  return {
    title,
    description,
    alternates: { canonical, languages: alternatePaths },
    openGraph: {
      type,
      title,
      description,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      url: canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function blogMetadata(locale: Locale): Metadata {
  const copy =
    locale === "ko"
      ? {
          title: "기술 블로그",
          description: "소프트웨어를 이해하기 쉽게 만드는 방법에 관한 기술 글",
        }
      : {
          title: "Engineering Blog",
          description:
            "Technical articles about building understandable software.",
        };
  return metadata({
    ...copy,
    locale,
    canonical: `/${locale}`,
    alternatePaths: { ko: "/ko", en: "/en" },
    imageId: "blog",
  });
}

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams(): Promise<StaticPageParam[]> {
  const documents = await Promise.all(locales.map(getLocalizedDocuments));
  return [
    ...locales.map((locale) => ({ locale, slug: [] })),
    ...locales.map((locale) => ({ locale, slug: ["series"] })),
    ...locales.map((locale) => ({ locale, slug: ["showcase"] })),
    ...locales.map((locale) => ({ locale, slug: ["docs"] })),
    ...locales.flatMap((locale) =>
      docsCategoryIds.map((category) => ({
        locale,
        slug: ["docs", category],
      })),
    ),
    ...documents.flatMap((entries) =>
      docsCategoryIds.flatMap((category) =>
        documentsForDocsCategory(entries, category).map((document) => ({
          locale: document.locale,
          slug: ["docs", category, document.id],
        })),
      ),
    ),
    ...locales.flatMap((locale) =>
      Object.keys(seriesRegistry).map((id) => ({
        locale,
        slug: ["series", id],
      })),
    ),
    ...documents.flatMap((entries) =>
      entries.map((document) => ({
        locale: document.locale,
        slug: [document.id],
      })),
    ),
  ];
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
  params,
}: PageProps<"/tech/[locale]/[[...slug]]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (slug === undefined || slug.length === 0) return blogMetadata(locale);
  if (slug.length === 1 && slug[0] === "series")
    return metadata({
      title: locale === "ko" ? "시리즈" : "Series",
      description:
        locale === "ko"
          ? "주제별로 순서 있는 기술 글 모음"
          : "Ordered collections of technical articles by topic.",
      locale,
      canonical: createSeriesHref(locale),
      alternatePaths: {
        ko: createSeriesHref("ko"),
        en: createSeriesHref("en"),
      },
      imageId: "series",
    });
  if (slug.length === 1 && slug[0] === "showcase")
    return metadata({
      title: locale === "ko" ? "애니메이션 쇼케이스" : "Animation Showcase",
      description:
        locale === "ko"
          ? "인터랙티브 타임라인과 코드 기반 설명 애니메이션의 제작 모델을 비교합니다."
          : "Compare interactive timelines with code-authored explanatory animation.",
      locale,
      canonical: `/${locale}/showcase`,
      alternatePaths: {
        ko: "/ko/showcase",
        en: "/en/showcase",
      },
      imageId: "showcase",
    });
  if (slug.length === 1 && slug[0] === "docs")
    return metadata({
      title: "Docs",
      description:
        locale === "ko"
          ? "프론트엔드와 Kubernetes 기술 지식을 주제별 문서로 탐색합니다."
          : "Explore topic-oriented frontend and Kubernetes engineering documentation.",
      locale,
      canonical: createDocsHref(locale),
      alternatePaths: {
        ko: createDocsHref("ko"),
        en: createDocsHref("en"),
      },
      imageId: "docs",
    });
  if (
    slug.length >= 2 &&
    slug[0] === "docs" &&
    slug[1] !== undefined &&
    isDocsCategoryId(slug[1])
  ) {
    const categoryId = slug[1];
    const category = getDocsCategory(categoryId, locale);
    if (slug.length === 2)
      return metadata({
        title:
          locale === "ko"
            ? `${category.title} 엔지니어링 문서`
            : `${category.title} Engineering Docs`,
        description: category.description,
        locale,
        canonical: createDocsHref(locale, categoryId),
        alternatePaths: {
          ko: createDocsHref("ko", categoryId),
          en: createDocsHref("en", categoryId),
        },
        imageId: `docs/${categoryId}`,
      });
    if (slug.length === 3 && slug[2] !== undefined) {
      const document = await findDocument(locale, slug[2]);
      if (
        document === null ||
        !documentsForDocsCategory([document], categoryId).includes(document)
      )
        notFound();
      return metadata({
        title: document.title,
        description: document.description,
        locale,
        canonical: document.href,
        alternatePaths: {
          ko: createDocHref("ko", document.id),
          en: createDocHref("en", document.id),
        },
        imageId: document.id,
        type: "article",
      });
    }
  }
  if (slug.length === 2 && slug[0] === "series" && isSeriesId(slug[1] ?? "")) {
    const id = slug[1] as SeriesId;
    const series = getSeries(id, locale);
    if (series === null) notFound();
    return metadata({
      title: series.title,
      description: series.description,
      locale,
      canonical: createSeriesHref(locale, id),
      alternatePaths: {
        ko: createSeriesHref("ko", id),
        en: createSeriesHref("en", id),
      },
      imageId: `series/${id}`,
    });
  }
  if (slug.length !== 1 || slug[0] === undefined) notFound();
  const document = await findDocument(locale, slug[0]);
  if (document === null) notFound();
  return metadata({
    title: document.title,
    description: document.description,
    locale,
    canonical: document.href,
    alternatePaths: {
      ko: createDocHref("ko", document.id),
      en: createDocHref("en", document.id),
    },
    imageId: document.id,
    type: "article",
  });
}

/** `DocsPage` 페이지 UI를 렌더링함 */
export default async function DocsPage({
  params,
  searchParams,
}: PageProps<"/tech/[locale]/[[...slug]]">): Promise<React.JSX.Element> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const alternate = otherLocale(locale);
  if (slug === undefined || slug.length === 0) {
    const query = await searchParams;
    return (
      <DocsShell alternateHref={`/${alternate}`} locale={locale}>
        <BlogIndex
          documents={await getLocalizedDocuments(locale)}
          locale={locale}
          searchParams={query}
        />
      </DocsShell>
    );
  }
  if (slug.length === 1 && slug[0] === "series") {
    const documents = await getLocalizedDocuments(locale);
    const counts = Object.fromEntries(
      Object.keys(seriesRegistry).map((id) => [
        id,
        documents.filter((document) => document.series === id).length,
      ]),
    ) as Record<SeriesId, number>;
    return (
      <DocsShell
        active="series"
        alternateHref={createSeriesHref(alternate)}
        locale={locale}
      >
        <SeriesIndex counts={counts} locale={locale} />
      </DocsShell>
    );
  }
  if (slug.length === 1 && slug[0] === "showcase")
    return (
      <DocsShell
        active="showcase"
        alternateHref={`/${alternate}/showcase`}
        locale={locale}
      >
        <ShowcasePage locale={locale} />
      </DocsShell>
    );
  if (slug.length === 1 && slug[0] === "docs") {
    const documents = await getLocalizedDocuments(locale);
    return (
      <DocsShell
        active="docs"
        alternateHref={createDocsHref(alternate)}
        locale={locale}
      >
        <DocsLandingPage documents={documents} locale={locale} />
      </DocsShell>
    );
  }
  if (
    slug.length >= 2 &&
    slug[0] === "docs" &&
    slug[1] !== undefined &&
    isDocsCategoryId(slug[1])
  ) {
    const categoryId = slug[1];
    const documents = await getLocalizedDocuments(locale);
    if (slug.length === 2)
      return (
        <DocsShell
          active="docs"
          alternateHref={createDocsHref(alternate, categoryId)}
          docsCategory={categoryId}
          locale={locale}
        >
          <DocsCategoryPage
            categoryId={categoryId}
            documents={documents}
            locale={locale}
          />
        </DocsShell>
      );
    if (slug.length === 3 && slug[2] !== undefined) {
      const document = await loadDocument(locale, slug[2]);
      if (
        document === null ||
        documentsForDocsCategory([document.metadata], categoryId).length === 0
      )
        notFound();
      return (
        <DocsShell
          active="docs"
          alternateHref={createDocsHref(
            alternate,
            categoryId,
            document.metadata.id,
          )}
          docsCategory={categoryId}
          locale={locale}
        >
          <DocsArticlePage
            categoryId={categoryId}
            document={document}
            documents={documents}
            locale={locale}
          />
        </DocsShell>
      );
    }
    notFound();
  }
  if (slug.length === 2 && slug[0] === "series" && isSeriesId(slug[1] ?? "")) {
    const id = slug[1] as SeriesId;
    const documents = (await getLocalizedDocuments(locale))
      .filter((document) => document.series === id)
      .toSorted(
        (left, right) => (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0),
      );
    return (
      <DocsShell
        active="series"
        alternateHref={createSeriesHref(alternate, id)}
        locale={locale}
      >
        <SeriesDetail documents={documents} id={id} locale={locale} />
      </DocsShell>
    );
  }
  if (slug.length !== 1 || slug[0] === undefined) notFound();
  const document = await loadDocument(locale, slug[0]);
  if (document === null) notFound();
  return (
    <DocsShell
      alternateHref={createDocHref(alternate, document.metadata.id)}
      locale={locale}
    >
      <DocumentPage document={document} locale={locale} />
    </DocsShell>
  );
}
