import type { SearchDocument } from "./content-model";

export type SearchMatchField = "title" | "apiSymbol" | "heading" | "tag" | "description" | "body";

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

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function fieldScore(value: string, terms: readonly string[], weight: number): number {
  const normalized = normalize(value);
  return terms.reduce((score, term) => {
    if (normalized === term) return score + weight * 3;
    if (normalized.startsWith(term)) return score + weight * 2;
    if (normalized.includes(term)) return score + weight;
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
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return { field: "description", text: document.description };

  const candidates = [
    {
      field: "title",
      match: bestValueMatch([document.title], terms, fieldWeights.title),
    },
    {
      field: "apiSymbol",
      match: bestValueMatch(document.apiSymbols, terms, fieldWeights.apiSymbols),
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
      match: bestValueMatch([document.description], terms, fieldWeights.description),
    },
    {
      field: "body",
      match: bestValueMatch([document.body], terms, fieldWeights.body),
    },
  ] as const;
  const best = candidates.reduce<(typeof candidates)[number] | null>((current, candidate) => {
    if (candidate.match === null) return current;
    if (current?.match !== null && current?.match !== undefined) {
      return current.match.score >= candidate.match.score ? current : candidate;
    }
    return candidate;
  }, null);

  if (best === null || best.match === null) {
    return { field: "description", text: document.description };
  }
  return {
    field: best.field,
    text: best.field === "body" ? bodySnippet(document.body, terms) : best.match.value,
  };
}

export function scoreSearchDocument(document: SearchDocument, query: string): number {
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return 1;

  return (
    fieldScore(document.title, terms, fieldWeights.title) +
    fieldScore(document.apiSymbols.join(" "), terms, fieldWeights.apiSymbols) +
    fieldScore(document.headings.join(" "), terms, fieldWeights.headings) +
    fieldScore(document.tags.join(" "), terms, fieldWeights.tags) +
    fieldScore(document.description, terms, fieldWeights.description) +
    fieldScore(document.body, terms, fieldWeights.body)
  );
}

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
    .sort((left, right) => right.score - left.score || left.document.order - right.document.order)
    .slice(0, limit);
}
