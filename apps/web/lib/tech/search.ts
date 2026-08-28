import type { SortedResult } from "fumadocs-core/search";

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

/** 공백 없는 질의를 검색 사전의 가장 긴 단어열로 분해함 */
export function segmentSearchQuery(
  query: string,
  terms: Iterable<string>,
): string {
  const normalized = normalizeSearchText(query);
  if (normalized.includes(" ")) return normalized;
  const input = compact(normalized);
  const dictionary = [...terms]
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

/** 두 검색 source의 page group을 중복 없이 번갈아 배치함 */
export function interleaveSearchResults(
  left: readonly SortedResult[],
  right: readonly SortedResult[],
  limit: number,
): readonly SortedResult[] {
  const groups = [groupResults(left), groupResults(right)];
  const seen = new Set<string>();
  const output: SortedResult[] = [];
  for (
    let index = 0;
    groups.some((group) => index < group.length);
    index += 1
  ) {
    for (const sourceGroups of groups) {
      const group = sourceGroups[index];
      const url = group?.[0]?.url;
      if (group === undefined || url === undefined || seen.has(url)) continue;
      seen.add(url);
      output.push(...group);
      if (output.length >= limit) return output.slice(0, limit);
    }
  }
  return output.slice(0, limit);
}
