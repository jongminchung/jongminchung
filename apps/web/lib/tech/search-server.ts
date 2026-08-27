import type { SortedResult } from "fumadocs-core/search";
import { createFromSource } from "fumadocs-core/search/server";
import { techSource } from "../fumadocs-source.ts";

/** 검색어와 색인 별칭에 공통 적용할 Unicode 정규화를 수행함 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeSearchText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

const searchTerms = new Map(
  (["ko", "en"] as const).map((locale) => [
    locale,
    new Set(
      techSource
        .getPages(locale)
        .flatMap((page) =>
          [
            page.data.title,
            page.data.description,
            ...page.data.tags,
            ...(page.data.apiSymbols ?? []),
          ].flatMap(
            (value) =>
              normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [],
          ),
        ),
    ),
  ]),
);

/** 공백 없는 질의를 locale 메타데이터 사전의 가장 긴 단어열로 분해함 */
export function segmentSearchQuery(query: string, locale: "ko" | "en"): string {
  const normalized = normalizeSearchText(query);
  if (normalized.includes(" ")) return normalized;
  const input = compact(normalized);
  const dictionary = [...(searchTerms.get(locale) ?? [])]
    .map(compact)
    .filter((term) => term.length >= 2 && input.includes(term))
    .toSorted((left, right) => right.length - left.length);
  const paths = new Map<number, string[]>([[0, []]]);
  for (let index = 0; index < input.length; index += 1) {
    const path = paths.get(index);
    if (path === undefined) continue;
    for (const term of dictionary) {
      if (!input.startsWith(term, index)) continue;
      const next = index + term.length;
      const candidate = [...path, term];
      const current = paths.get(next);
      if (current === undefined || candidate.length < current.length)
        paths.set(next, candidate);
    }
  }
  return paths.get(input.length)?.join(" ") ?? normalized;
}

/** 띄어쓰기 없는 한영 질의를 위한 연속 단어 별칭을 생성함 */
export function createSearchAliases(
  values: readonly string[],
): readonly string[] {
  const aliases = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSearchText(value);
    if (normalized.length === 0) continue;
    aliases.add(normalized);
    const words = normalized.split(" ").filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
      for (
        let length = 2;
        length <= 8 && start + length <= words.length;
        length += 1
      ) {
        aliases.add(words.slice(start, start + length).join(""));
      }
    }
  }
  return Object.freeze([...aliases]);
}

function groupResults(
  results: readonly SortedResult[],
): readonly SortedResult[][] {
  const groups: SortedResult[][] = [];
  for (const result of results) {
    if (result.type === "page") groups.push([result]);
    else groups.at(-1)?.push(result);
  }
  return groups;
}

/** 결과 그룹에 검색 토큰 절반 이상이 실제 포함된 경우만 유지함 */
export function filterSearchResults(
  results: readonly SortedResult[],
  query: string,
): readonly SortedResult[] {
  const tokens = normalizeSearchText(query)
    .split(" ")
    .map(compact)
    .filter(Boolean);
  if (tokens.length === 0) return results;
  const required = Math.ceil(tokens.length / 2);
  return groupResults(results).flatMap((group) => {
    const corpus = compact(group.map(({ content }) => content).join(" "));
    const matched = tokens.filter((token) => corpus.includes(token)).length;
    return matched >= required ? group : [];
  });
}

const searchApi = createFromSource(techSource, {
  buildIndex: async (page) => {
    const structuredData = await page.data.structuredData();
    const aliases = createSearchAliases([
      page.data.title,
      page.data.description,
      ...page.data.tags,
      ...(page.data.apiSymbols ?? []),
      ...structuredData.headings.map(({ content }) => content),
    ]);
    return {
      id: page.url,
      title: page.data.title,
      description: page.data.description,
      breadcrumbs: page.data.series === undefined ? [] : [page.data.series],
      tag: [...page.data.tags],
      url: page.url,
      structuredData: {
        headings: structuredData.headings,
        contents: [
          ...structuredData.contents,
          ...aliases.map((content) => ({ heading: undefined, content })),
        ],
      },
    };
  },
});

/** locale별 ZBSearch 결과를 제품 검색 품질 규칙으로 후처리함 */
export async function searchTechDocuments(
  query: string,
  locale: "ko" | "en",
  limit = 32,
): Promise<readonly SortedResult[]> {
  const effectiveQuery = segmentSearchQuery(query, locale);
  const results = await searchApi.search(effectiveQuery, { locale, limit });
  return filterSearchResults(results, effectiveQuery);
}
