import {
    type Locale,
    locales,
    sectionLandingSections,
} from "#lib/content-model";
import { getLocalizedDocuments } from "#lib/documents";
import { llmsSectionLabels } from "#lib/tech/copy";
import { findSectionPage } from "#lib/tech/section-pages";

const siteOrigin = "https://tech.jamie.kr";

function absoluteUrl(pathname: string): string {
    return new URL(pathname, siteOrigin).toString();
}

function documentLine(
    document: Awaited<ReturnType<typeof getLocalizedDocuments>>[number],
): string {
    return `- [${document.title}](${absoluteUrl(document.href)}): ${document.description} Status: ${document.status}; updated ${document.updatedAt}.`;
}

async function createLocaleSections(
    locale: Locale,
): Promise<readonly string[]> {
    const documents = await getLocalizedDocuments(locale);
    const overview = documents.find(
        (document) => document.section === "overview",
    );
    if (overview === undefined)
        throw new Error(`Missing ${locale}/overview documentation.`);
    const sectionLines = await Promise.all(
        sectionLandingSections.map(async (section) => {
            const page = await findSectionPage(locale, section);
            if (page === null)
                throw new Error(`Missing ${locale}/${section} section page.`);
            return `- [${page.title}](${absoluteUrl(page.href)}): ${page.description}`;
        }),
    );
    const startLines = [
        `## ${llmsSectionLabels[locale].overview}`,
        "",
        documentLine(overview),
        ...sectionLines,
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

/** 요청에 대한 응답을 생성함 */
export async function GET(): Promise<Response> {
    const lines = [
        "# Engineering Notes",
        "",
        "> Bilingual engineering articles organized as Handbook and Deep Dive series.",
        "",
        "Korean and English documents share stable IDs. Prefer the language that matches the user's request.",
        "",
        ...(await Promise.all(locales.map(createLocaleSections))).flat(),
    ];
    return new Response(`${lines.join("\n").trimEnd()}\n`, {
        headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
