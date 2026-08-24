import type { SearchDocument } from "../content-model";

export type SearchMatchField =
  | "title"
  | "apiSymbol"
  | "heading"
  | "tag"
  | "description"
  | "body";

export interface SearchMatch {
  readonly field: SearchMatchField;
  readonly text: string;
}

export interface SearchHit {
  readonly document: SearchDocument;
  readonly score: number;
  readonly match: SearchMatch;
}

const fieldWeights = {
  title: 10,
  apiSymbols: 8,
  headings: 6,
  tags: 5,
  description: 3,
  body: 1,
} as const;
const MINIMUM_MULTI_TERM_COVERAGE = 0.5;

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function compact(value: string): string {
  return normalize(value).replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 한국어와 한영 혼합 질의를 결정적으로 분리함 */
export function tokenizeSearchQuery(query: string): readonly string[] {
  const normalized = normalize(query).trim();
  if (normalized.length === 0) return [];
  const segmenter = new Intl.Segmenter(["ko", "en"], {
    granularity: "word",
  });
  const segmented = [...segmenter.segment(normalized)]
    .filter((item) => item.isWordLike)
    .map((item) => item.segment);
  return Object.freeze(segmented.length > 0 ? segmented : [normalized]);
}

function fieldScore(
  value: string,
  terms: readonly string[],
  weight: number,
): number {
  const normalized = normalize(value);
  const compactValue = compact(value);
  return terms.reduce((score, term) => {
    if (normalized === term) return score + weight * 3;
    if (normalized.startsWith(term)) return score + weight * 2;
    if (normalized.includes(term)) return score + weight;
    const compactTerm = compact(term);
    if (compactTerm.length >= 2 && compactValue.includes(compactTerm))
      return score + weight;
    return score;
  }, 0);
}

function bestValueMatch(
  values: readonly string[],
  terms: readonly string[],
  weight: number,
): { readonly score: number; readonly value: string } | null {
  return values.reduce<{
    readonly score: number;
    readonly value: string;
  } | null>((best, value) => {
    const score = fieldScore(value, terms, weight);
    if (score === 0 || (best !== null && best.score >= score)) return best;
    return { score, value };
  }, null);
}

function bodySnippet(body: string, terms: readonly string[]): string {
  const normalized = normalize(body);
  const index = terms.reduce((best, term) => {
    const next = normalized.indexOf(term);
    if (next < 0) return best;
    return best < 0 ? next : Math.min(best, next);
  }, -1);
  if (index < 0) return body.slice(0, 120);
  const start = Math.max(0, index - 44);
  const end = Math.min(body.length, index + 92);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}

function matchFor(document: SearchDocument, query: string): SearchMatch {
  const terms = tokenizeSearchQuery(query);
  if (terms.length === 0)
    return { field: "description", text: document.description };

  const candidates = [
    {
      field: "title",
      match: bestValueMatch([document.title], terms, fieldWeights.title),
    },
    {
      field: "apiSymbol",
      match: bestValueMatch(
        document.apiSymbols,
        terms,
        fieldWeights.apiSymbols,
      ),
    },
    {
      field: "heading",
      match: bestValueMatch(document.headings, terms, fieldWeights.headings),
    },
    {
      field: "tag",
      match: bestValueMatch(document.tags, terms, fieldWeights.tags),
    },
    {
      field: "description",
      match: bestValueMatch(
        [document.description],
        terms,
        fieldWeights.description,
      ),
    },
    {
      field: "body",
      match: bestValueMatch([document.body], terms, fieldWeights.body),
    },
  ] as const;
  const best = candidates.reduce<(typeof candidates)[number] | null>(
    (current, candidate) => {
      if (candidate.match === null) return current;
      if (current?.match !== null && current?.match !== undefined) {
        return current.match.score >= candidate.match.score
          ? current
          : candidate;
      }
      return candidate;
    },
    null,
  );

  if (best === null || best.match === null) {
    return { field: "description", text: document.description };
  }
  return {
    field: best.field,
    text:
      best.field === "body"
        ? bodySnippet(document.body, terms)
        : best.match.value,
  };
}

/** `scoreSearchDocument` 결과를 계산함 */
export function scoreSearchDocument(
  document: SearchDocument,
  query: string,
): number {
  const terms = tokenizeSearchQuery(query);
  if (terms.length === 0) return 1;

  const searchable = normalize(
    [
      document.title,
      ...document.apiSymbols,
      ...document.headings,
      ...document.tags,
      document.description,
      document.body,
    ].join(" "),
  );
  const compactSearchable = compact(searchable);
  const matchedTerms = terms.filter(
    (term) =>
      searchable.includes(term) ||
      (compact(term).length >= 2 && compactSearchable.includes(compact(term))),
  );
  if (matchedTerms.length === 0) return 0;
  const coverage = matchedTerms.length / terms.length;
  if (terms.length > 1 && coverage < MINIMUM_MULTI_TERM_COVERAGE) return 0;

  const fieldTotal =
    fieldScore(document.title, terms, fieldWeights.title) +
    fieldScore(document.apiSymbols.join(" "), terms, fieldWeights.apiSymbols) +
    fieldScore(document.headings.join(" "), terms, fieldWeights.headings) +
    fieldScore(document.tags.join(" "), terms, fieldWeights.tags) +
    fieldScore(document.description, terms, fieldWeights.description) +
    fieldScore(document.body, terms, fieldWeights.body);
  return fieldTotal * coverage * coverage;
}

export interface SearchBenchmarkCase {
  readonly query: string;
  readonly expectedIds: readonly string[];
  readonly locale?: SearchDocument["locale"];
  readonly expectNoResults?: boolean;
}

export interface SearchBenchmarkReport {
  readonly queries: number;
  readonly top1HitRate: number;
  readonly top3HitRate: number;
  readonly meanReciprocalRank: number;
  readonly zeroResultRate: number;
  readonly positiveQueries: number;
  readonly noResultQueries: number;
  readonly noResultAccuracy: number;
  readonly unexpectedZeroResultRate: number;
}

export interface SearchIndexCost {
  readonly engine: "built-in";
  readonly indexBytes: number;
  readonly initialRequestCount: 1;
  readonly runtimeDependencyBytes: 0;
}

export interface SearchBenchmarkThresholds {
  readonly minTop1HitRate: number;
  readonly minTop3HitRate: number;
  readonly minMeanReciprocalRank: number;
  readonly expectedZeroResultRate: number;
  readonly minNoResultAccuracy: number;
  readonly maxUnexpectedZeroResultRate: number;
  readonly maxIndexBytes: number;
  readonly maxRuntimeDependencyBytes: number;
}

/** 동일 corpus로 검색 변경 전후의 relevance를 비교함 */
export function evaluateSearchBenchmark(
  documents: readonly SearchDocument[],
  cases: readonly SearchBenchmarkCase[],
): SearchBenchmarkReport {
  let top1 = 0;
  let top3 = 0;
  let reciprocalRank = 0;
  let zeroResults = 0;
  let positiveQueries = 0;
  let noResultQueries = 0;
  let correctNoResults = 0;
  let unexpectedZeroResults = 0;
  for (const benchmark of cases) {
    if (
      (benchmark.expectNoResults === true) !==
      (benchmark.expectedIds.length === 0)
    ) {
      throw new Error(
        `Search benchmark must distinguish a target from no results: ${benchmark.query}`,
      );
    }
    const candidates =
      benchmark.locale === undefined
        ? documents
        : documents.filter((document) => document.locale === benchmark.locale);
    const results = searchDocuments(candidates, benchmark.query);
    if (results.length === 0) zeroResults += 1;
    if (benchmark.expectNoResults === true) {
      noResultQueries += 1;
      if (results.length === 0) correctNoResults += 1;
      continue;
    }
    positiveQueries += 1;
    if (results.length === 0) unexpectedZeroResults += 1;
    const rank = results.findIndex((result) =>
      benchmark.expectedIds.includes(result.document.id),
    );
    if (rank === 0) top1 += 1;
    if (rank >= 0 && rank < 3) top3 += 1;
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
  }
  const denominator = Math.max(1, positiveQueries);
  return Object.freeze({
    queries: cases.length,
    top1HitRate: top1 / denominator,
    top3HitRate: top3 / denominator,
    meanReciprocalRank: reciprocalRank / denominator,
    zeroResultRate: zeroResults / Math.max(1, cases.length),
    positiveQueries,
    noResultQueries,
    noResultAccuracy: correctNoResults / Math.max(1, noResultQueries),
    unexpectedZeroResultRate:
      unexpectedZeroResults / Math.max(1, positiveQueries),
  });
}

/** 전송되는 JSON index와 검색 runtime 의존성 비용을 계산함 */
export function measureSearchIndexCost(
  documents: readonly SearchDocument[],
): SearchIndexCost {
  return Object.freeze({
    engine: "built-in",
    indexBytes: new TextEncoder().encode(JSON.stringify(documents)).length,
    initialRequestCount: 1,
    runtimeDependencyBytes: 0,
  });
}

/** relevance와 index 비용이 고정된 품질 예산을 만족하는지 검증함 */
export function assertSearchBenchmarkThresholds(
  report: SearchBenchmarkReport,
  cost: SearchIndexCost,
  thresholds: SearchBenchmarkThresholds,
): void {
  const failures = [
    report.top1HitRate < thresholds.minTop1HitRate && "top-1 hit rate",
    report.top3HitRate < thresholds.minTop3HitRate && "top-3 hit rate",
    report.meanReciprocalRank < thresholds.minMeanReciprocalRank && "MRR",
    report.zeroResultRate !== thresholds.expectedZeroResultRate &&
      "zero-result rate",
    report.noResultAccuracy < thresholds.minNoResultAccuracy &&
      "no-result accuracy",
    report.unexpectedZeroResultRate > thresholds.maxUnexpectedZeroResultRate &&
      "unexpected zero-result rate",
    cost.indexBytes > thresholds.maxIndexBytes && "search index bytes",
    cost.runtimeDependencyBytes > thresholds.maxRuntimeDependencyBytes &&
      "runtime dependency bytes",
  ].filter((failure): failure is string => typeof failure === "string");
  if (failures.length > 0)
    throw new Error(
      `Search benchmark thresholds failed: ${failures.join(", ")}`,
    );
}

/** `searchDocuments` 공개 기능을 제공함 */
export function searchDocuments(
  documents: readonly SearchDocument[],
  query: string,
  limit = 24,
): readonly SearchHit[] {
  return documents
    .map((document) => ({
      document,
      score: scoreSearchDocument(document, query),
      match: matchFor(document, query),
    }))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.document.id.localeCompare(right.document.id),
    )
    .slice(0, limit);
}
