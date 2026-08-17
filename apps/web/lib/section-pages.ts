import {
    createSectionHref,
    isLocale,
    isSectionLanding,
    type ContentManifestEntry,
    type Locale,
    type SectionLanding,
} from "./content-model";
import { getSectionDocuments } from "./documents";

interface SectionPageCopy {
    readonly title: string;
    readonly description: string;
}

export interface SectionPage extends SectionPageCopy {
    readonly kind: "section";
    readonly locale: Locale;
    readonly section: SectionLanding;
    readonly href: string;
    readonly updatedAt: string;
    readonly documents: readonly ContentManifestEntry[];
}

const sectionPageCopy: Readonly<
    Record<Locale, Readonly<Record<SectionLanding, SectionPageCopy>>>
> = {
    ko: {
        handbook: {
            title: "핸드북",
            description:
                "협업과 도메인 설계에서 함께 사용할 공통 기준을 정리합니다.",
        },
        "deep-dive": {
            title: "Deep Dive",
            description:
                "플랫폼과 도구의 선택, 동작 원리와 실패 사례를 깊이 추적합니다.",
        },
    },
    en: {
        handbook: {
            title: "Handbook",
            description:
                "Align on shared principles for collaboration and domain design.",
        },
        "deep-dive": {
            title: "Deep Dive",
            description:
                "Trace platform choices, runtime behavior, and failure cases in depth.",
        },
    },
};

function compareByRecentUpdate(
    left: ContentManifestEntry,
    right: ContentManifestEntry,
): number {
    return (
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.order - right.order ||
        left.id.localeCompare(right.id)
    );
}

export function findSectionPage(
    locale: string,
    section: string,
): SectionPage | null {
    if (!isLocale(locale) || !isSectionLanding(section)) return null;
    const documents = getSectionDocuments(locale, section).toSorted(
        compareByRecentUpdate,
    );
    const latest = documents[0];
    if (latest === undefined) return null;
    const copy = sectionPageCopy[locale][section];
    return Object.freeze({
        kind: "section",
        locale,
        section,
        href: createSectionHref(locale, section),
        title: copy.title,
        description: copy.description,
        updatedAt: latest.updatedAt,
        documents: Object.freeze(documents),
    });
}
