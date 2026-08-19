import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
    type ContentManifestEntry,
    createDocHref,
    createOgImageHref,
    createSectionHref,
    type CurrentNavigationEntry,
    isLocale,
    locales,
    type Locale,
    type NavigationEntry,
    sectionLandingSections,
} from "#lib/content-model";
import {
    findDocument,
    getDocuments,
    getLocalizedDocuments,
    loadDocument,
} from "#lib/documents";
import { findSectionPage, type SectionPage } from "#lib/tech/section-pages";
import { DocsShell } from "#tech-components/DocsShell";
import { DocumentPage } from "#tech-components/DocumentPage";
import { SectionLandingPage } from "#tech-components/SectionLanding";

interface StaticPageParam {
    readonly locale: string;
    readonly slug: readonly string[];
}

async function idFromRoute(
    locale: string,
    slug: readonly string[] | undefined,
): Promise<string | null> {
    if (slug === undefined || slug.length === 0) return "overview";
    if (slug.length === 2 && slug[0] === "series") return slug[1] ?? null;
    if (slug.length !== 2 || slug[0] !== "articles") return null;
    const articleSlug = slug[1];
    if (articleSlug === undefined) return null;
    return (
        (await getDocuments()).find(
            (document) =>
                document.locale === locale &&
                document.section !== "overview" &&
                document.id.endsWith(`/${articleSlug}`),
        )?.id ?? null
    );
}

function toNavigationEntry(document: ContentManifestEntry): NavigationEntry {
    return Object.freeze({
        id: document.id,
        section: document.section,
        title: document.title,
        ...(document.displayTitle === undefined
            ? {}
            : { displayTitle: document.displayTitle }),
        href: document.href,
    });
}

function toCurrentNavigationEntry(
    document: ContentManifestEntry,
): CurrentNavigationEntry {
    return Object.freeze({
        ...toNavigationEntry(document),
        kind: "document",
        outline: document.outline,
    });
}

function toCurrentSectionEntry(page: SectionPage): CurrentNavigationEntry {
    return Object.freeze({
        kind: "section",
        id: page.section,
        section: page.section,
        title: page.title,
        href: page.href,
    });
}

function createMetadata({
    type,
    title,
    description,
    locale,
    canonical,
    alternatePaths,
    imageId,
}: {
    readonly type: "article" | "website";
    readonly title: string;
    readonly description: string;
    readonly locale: Locale;
    readonly canonical: string;
    readonly alternatePaths: Record<Locale, string>;
    readonly imageId: string;
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
        alternates: {
            canonical,
            languages: alternatePaths,
        },
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

function documentMetadata(document: ContentManifestEntry): Metadata {
    return createMetadata({
        type: "article",
        title: document.title,
        description: document.description,
        locale: document.locale,
        canonical: document.href,
        alternatePaths: {
            ko: createDocHref("ko", document.id),
            en: createDocHref("en", document.id),
        },
        imageId: document.id,
    });
}

function sectionMetadata(page: SectionPage): Metadata {
    return createMetadata({
        type: "website",
        title: page.title,
        description: page.description,
        locale: page.locale,
        canonical: page.href,
        alternatePaths: {
            ko: createSectionHref("ko", page.section),
            en: createSectionHref("en", page.section),
        },
        imageId: page.section,
    });
}

export const dynamicParams = true;

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams(): Promise<StaticPageParam[]> {
    const documentParams = (await getDocuments())
        .filter((document) => document.section !== "overview")
        .map((document) => ({
            locale: document.locale,
            slug: ["articles", document.id.split("/").at(-1) ?? document.id],
        }));
    const overviewParams = locales.map((locale) => ({ locale, slug: [] }));
    const sectionParams = locales.flatMap((locale) =>
        sectionLandingSections.map((section) => ({
            locale,
            slug: ["series", section],
        })),
    );
    return [...overviewParams, ...documentParams, ...sectionParams];
}

/** 경로 매개변수에 맞는 페이지 메타데이터를 생성함 */
export async function generateMetadata({
    params,
}: PageProps<"/tech/[locale]/[[...slug]]">): Promise<Metadata> {
    const { locale, slug } = await params;
    const id = await idFromRoute(locale, slug);
    if (id === null) notFound();
    const sectionPage = await findSectionPage(locale, id);
    if (sectionPage !== null) return sectionMetadata(sectionPage);
    const document = await findDocument(locale, id);
    if (document === null) notFound();
    return documentMetadata(document);
}

/** `DocsPage` 페이지 UI를 렌더링함 */
export default async function DocsPage({
    params,
}: PageProps<"/tech/[locale]/[[...slug]]">): Promise<React.JSX.Element> {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const id = await idFromRoute(locale, slug);
    if (id === null) notFound();
    const navigationEntries = (await getLocalizedDocuments(locale)).map(
        toNavigationEntry,
    );
    const sectionPage = await findSectionPage(locale, id);
    if (sectionPage !== null) {
        return (
            <DocsShell
                locale={locale}
                current={toCurrentSectionEntry(sectionPage)}
                documents={navigationEntries}
            >
                <SectionLandingPage page={sectionPage} />
            </DocsShell>
        );
    }
    const document = await loadDocument(locale, id);
    if (document === null) notFound();
    return (
        <DocsShell
            locale={locale}
            current={toCurrentNavigationEntry(document.metadata)}
            documents={navigationEntries}
        >
            <DocumentPage locale={locale} document={document} />
        </DocsShell>
    );
}
