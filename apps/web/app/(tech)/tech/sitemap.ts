import type { MetadataRoute } from "next";
import {
    createDocHref,
    createSectionHref,
    locales,
    sectionLandingSections,
} from "#lib/content-model";
import { getDocuments } from "#lib/documents";

const siteOrigin = "https://tech.jamie.kr";

function absoluteUrl(pathname: string): string {
    return new URL(pathname, siteOrigin).toString();
}

/** 사이트맵 항목을 생성함 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const manifest = await getDocuments();
    const documentEntries: MetadataRoute.Sitemap = manifest.map((document) => ({
        url: absoluteUrl(document.href),
        lastModified: document.updatedAt,
        alternates: {
            languages: Object.fromEntries(
                locales.map((locale) => [
                    locale,
                    absoluteUrl(createDocHref(locale, document.id)),
                ]),
            ),
        },
    }));
    const sectionEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
        sectionLandingSections.map((section) => {
            const latest = manifest
                .filter(
                    (document) =>
                        document.locale === locale &&
                        document.section === section,
                )
                .toSorted(
                    (left, right) =>
                        right.updatedAt.localeCompare(left.updatedAt) ||
                        left.order - right.order,
                )[0];
            if (latest === undefined)
                throw new Error(`Missing ${locale}/${section} section page.`);
            return {
                url: absoluteUrl(createSectionHref(locale, section)),
                lastModified: latest.updatedAt,
                alternates: {
                    languages: Object.fromEntries(
                        locales.map((candidate) => [
                            candidate,
                            absoluteUrl(createSectionHref(candidate, section)),
                        ]),
                    ),
                },
            };
        }),
    );
    return [...documentEntries, ...sectionEntries];
}
