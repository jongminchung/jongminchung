import type { DocSection, Locale } from "../content-model.ts";
import type { SearchMatchField } from "./search.ts";

export const techSectionLabels: Readonly<
    Record<Locale, Readonly<Record<DocSection, string>>>
> = {
    ko: {
        overview: "개요",
        handbook: "핸드북",
        "deep-dive": "Deep Dive",
    },
    en: {
        overview: "Overview",
        handbook: "Handbook",
        "deep-dive": "Deep Dive",
    },
};

export const searchMatchLabels: Readonly<
    Record<Locale, Readonly<Record<SearchMatchField, string>>>
> = {
    ko: {
        title: "제목",
        apiSymbol: "API 심볼",
        heading: "문서 제목",
        tag: "태그",
        description: "요약",
        body: "본문",
    },
    en: {
        title: "Title",
        apiSymbol: "API symbol",
        heading: "Heading",
        tag: "Tag",
        description: "Summary",
        body: "Body",
    },
};

export const llmsSectionLabels: Readonly<
    Record<Locale, Readonly<Record<DocSection, string>>>
> = {
    ko: {
        overview: "한국어 시작점",
        handbook: "한국어 핸드북",
        "deep-dive": "한국어 Deep Dive",
    },
    en: {
        overview: "English start here",
        handbook: "English handbook",
        "deep-dive": "English Deep Dive",
    },
};
