import type { Locale } from "../content-model.ts";
import type { SearchMatchField } from "./search.ts";

export const searchMatchLabels: Readonly<
  Record<Locale, Readonly<Record<SearchMatchField, string>>>
> = {
  ko: {
    title: "제목",
    apiSymbol: "API 심볼",
    heading: "글 제목",
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
