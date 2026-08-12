import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsShell } from "#components/DocsShell";
import { DocumentPage } from "#components/DocumentPage";
import { SectionLandingPage } from "#components/SectionLanding";
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
    documents,
    findDocument,
    getLocalizedDocuments,
    loadDocument,
} from "#lib/documents";
import { findSectionPage, type SectionPage } from "#lib/section-pages";

interface PageProps {
    readonly params: Promise<{
        readonly locale: string;
        readonly slug: readonly string[];
    }>;
}

interface StaticPageParam {
    readonly locale: string;
    readonly slug: readonly string[];
}

function idFromSlug(slug: readonly string[]): string {
    return slug.join("/");
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

function socialImage(title: string, locale: Locale, id: string) {
    return {
        url: createOgImageHref(locale, id),
        width: 1200,
        height: 630,
        alt: `${title} · Jongmin Chung Engineering Docs`,
    };
}

function documentMetadata(document: ContentManifestEntry): Metadata {
    const image = socialImage(document.title, document.locale, document.id);
    return {
        title: document.title,
        description: document.description,
        alternates: {
            canonical: document.href,
            languages: {
                ko: createDocHref("ko", document.id),
                en: createDocHref("en", document.id),
            },
        },
        openGraph: {
            type: "article",
            title: document.title,
            description: document.description,
            locale: document.locale === "ko" ? "ko_KR" : "en_US",
            url: document.href,
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title: document.title,
            description: document.description,
            images: [image],
        },
    };
}

function sectionMetadata(page: SectionPage): Metadata {
    const image = socialImage(page.title, page.locale, page.section);
    return {
        title: page.title,
        description: page.description,
        alternates: {
            canonical: page.href,
            languages: {
                ko: createSectionHref("ko", page.section),
                en: createSectionHref("en", page.section),
            },
        },
        openGraph: {
            type: "website",
            title: page.title,
            description: page.description,
            locale: page.locale === "ko" ? "ko_KR" : "en_US",
            url: page.href,
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title: page.title,
            description: page.description,
            images: [image],
        },
    };
}

export const dynamicParams = false;

export function generateStaticParams(): StaticPageParam[] {
    const documentParams = documents.map((document) => ({
        locale: document.locale,
        slug: document.id.split("/"),
    }));
    const sectionParams = locales.flatMap((locale) =>
        sectionLandingSections.map((section) => ({ locale, slug: [section] })),
    );
    return [...documentParams, ...sectionParams];
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const id = idFromSlug(slug);
    const sectionPage = findSectionPage(locale, id);
    if (sectionPage !== null) return sectionMetadata(sectionPage);
    const document = findDocument(locale, id);
    if (document === null) notFound();
    return documentMetadata(document);
}

export default async function DocsPage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { locale, slug } = await params;
    if (!isLocale(locale)) notFound();
    const id = idFromSlug(slug);
    const navigationEntries =
        getLocalizedDocuments(locale).map(toNavigationEntry);
    const sectionPage = findSectionPage(locale, id);
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

export const preferredRegion = "auto";
