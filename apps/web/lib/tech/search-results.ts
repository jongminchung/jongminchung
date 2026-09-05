import type { SortedResult } from "fumadocs-core/search";
import type { Locale } from "../content-contracts.ts";
import { documentKindLabel, isDocumentKind } from "./document-kind.ts";

export interface SearchItem {
  readonly href: string;
  readonly label: string;
  readonly matchLabel: string;
  readonly matchText: string;
  readonly group: string;
  readonly badge: string;
}

interface SearchCopy {
  readonly body: string;
  readonly heading: string;
  readonly resultGroupBlog: string;
  readonly title: string;
}

function plainText(value: string): string {
  return value.replace(/<\/?mark>/gu, "");
}

/** 검색 결과를 페이지별로 묶고 알려지지 않은 문서 유형은 Docs로 표시함 */
export function toSearchItems(
  locale: Locale,
  results: readonly SortedResult[],
  copy: SearchCopy,
): SearchItem[] {
  const groups: SortedResult[][] = [];
  for (const result of results) {
    if (result.type === "page") groups.push([result]);
    else groups.at(-1)?.push(result);
  }
  return groups.map((resultsForPage) => {
    const page = resultsForPage[0];
    if (page === undefined) throw new Error("Search result group is empty");
    const match =
      resultsForPage.find(({ type }) => type === "heading") ??
      resultsForPage.find(({ type }) => type === "text") ??
      page;
    const pageTitle = plainText(page.content);
    const [type = "Blog", ...breadcrumbs] = page.breadcrumbs ?? [];
    const badge =
      type === "Blog"
        ? "Blog"
        : isDocumentKind(type)
          ? documentKindLabel(locale, type)
          : "Docs";
    const group =
      breadcrumbs.length === 0 ? copy.resultGroupBlog : breadcrumbs.join(" · ");
    const matchLabel =
      match.type === "page"
        ? copy.title
        : match.type === "heading"
          ? copy.heading
          : copy.body;
    return {
      href: match.url,
      label: pageTitle,
      group,
      badge,
      matchLabel,
      matchText: plainText(match.content),
    };
  });
}
