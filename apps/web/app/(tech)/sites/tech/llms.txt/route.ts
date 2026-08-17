import {
    type Locale,
    locales,
    sectionLandingSections,
} from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { findSectionPage } from "#lib/section-pages";
import { llmsSectionLabels } from "#lib/tech-copy";

const siteOrigin = "https://tech.jamie.kr";

function absoluteUrl(pathname: string): string {
    return new URL(pathname, siteOrigin).toString();
}

function documentLine(
    document: ReturnType<typeof getLocalizedDocuments>[number],
): string {
    return `- [${document.title}](${absoluteUrl(document.href)}): ${document.description} Status: ${document.status}; updated ${document.updatedAt}.`;
}

function createLocaleSections(locale: Locale): readonly string[] {
    const documents = getLocalizedDocuments(locale);
    const overview = documents.find(
        (document) => document.section === "overview",
    );
    if (overview === undefined)
        throw new Error(`Missing ${locale}/overview documentation.`);
    const startLines = [
        `## ${llmsSectionLabels[locale].overview}`,
        "",
        documentLine(overview),
        ...sectionLandingSections.map((section) => {
            const page = findSectionPage(locale, section);
            if (page === null)
                throw new Error(`Missing ${locale}/${section} section page.`);
            return `- [${page.title}](${absoluteUrl(page.href)}): ${page.description}`;
        }),
        "",
    ];
    const documentSections = sectionLandingSections.flatMap((section) => [
        `## ${llmsSectionLabels[locale][section]}`,
        "",
        ...documents
            .filter((document) => document.section === section)
            .map(documentLine),
        "",
    ]);
    return [...startLines, ...documentSections];
}

export const dynamic = "force-static";

export function GET(): Response {
    const lines = [
        "# Engineering Notes",
        "",
        "> Bilingual engineering articles organized as Handbook and Deep Dive series.",
        "",
        "Korean and English documents share stable IDs. Prefer the language that matches the user's request.",
        "",
        ...locales.flatMap(createLocaleSections),
    ];
    return new Response(`${lines.join("\n").trimEnd()}\n`, {
        headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
