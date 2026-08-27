import { describe, expect, test } from "vitest";
import type { DocMetadata, Locale } from "../lib/content-model.ts";
import {
  validateDocuments,
  validateInvestmentNotes,
  type ValidatedContentSource,
} from "../lib/content-validation.ts";
import type { InvestmentNoteMetadata } from "../lib/invest/content.ts";

function createDocument(
  locale: Locale,
  id: string,
  overrides: Partial<DocMetadata> = {},
): ValidatedContentSource<DocMetadata> {
  const metadata: DocMetadata = {
    id,
    locale,
    title: `${locale} ${id}`,
    description: `${locale} ${id} description`,
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: [],
    status: "stable",
    publicationStatus: "published",
    sourceUrl: "https://example.com/source",
    ...overrides,
  };
  return {
    metadata,
    body: `## ${metadata.title}\n`,
    filePath: `/fixture/${locale}/${metadata.id}.mdx`,
    relativePath: `${locale}/${metadata.id}.mdx`,
    extractedReferences: [],
  };
}

function createValidDocuments(): readonly ValidatedContentSource<DocMetadata>[] {
  return (["ko", "en"] as const).flatMap((locale) => [
    createDocument(locale, "overview"),
    createDocument(locale, "handbook"),
    createDocument(locale, "deep-dive"),
  ]);
}

function replaceDocuments(
  predicate: (document: ValidatedContentSource<DocMetadata>) => boolean,
  update: (
    document: ValidatedContentSource<DocMetadata>,
  ) => ValidatedContentSource<DocMetadata>,
): readonly ValidatedContentSource<DocMetadata>[] {
  return createValidDocuments().map((document) =>
    predicate(document) ? update(document) : document,
  );
}

function createInvestmentNote(
  locale: Locale,
  overrides: Partial<InvestmentNoteMetadata> = {},
): ValidatedContentSource<InvestmentNoteMetadata> {
  const metadata: InvestmentNoteMetadata = {
    id: "durable-investing",
    locale,
    title: `${locale} durable investing`,
    description: `${locale} durable investing description`,
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    status: "published",
    tags: ["portfolio"],
    sources: [
      {
        kind: "book",
        title: "The Durable Investor",
        creator: "Example Author",
      },
    ],
    ...overrides,
  };
  return {
    metadata,
    body: "<SourceSummary>Source</SourceSummary>\n<JamieNotes>Notes</JamieNotes>",
    filePath: `/fixture/${locale}/notes/${metadata.id}.mdx`,
    relativePath: `${locale}/notes/${metadata.id}.mdx`,
    extractedReferences: [],
  };
}

function createValidInvestmentNotes(): readonly ValidatedContentSource<InvestmentNoteMetadata>[] {
  return (["ko", "en"] as const).map((locale) => createInvestmentNote(locale));
}

describe("validateDocuments", () => {
  test("accepts a complete localized fixture", () => {
    expect(() => validateDocuments(createValidDocuments())).not.toThrow();
  });

  test("reports path and locale contract failures", () => {
    expect(() =>
      validateDocuments([
        ...createValidDocuments().slice(1),
        { ...createDocument("ko", "overview"), relativePath: "ko/wrong.mdx" },
      ]),
    ).toThrow("expected path ko/overview.mdx");
    expect(() =>
      validateDocuments(
        createValidDocuments().filter(
          ({ metadata }) =>
            !(metadata.locale === "en" && metadata.id === "overview"),
        ),
      ),
    ).toThrow("Document overview is missing locales: en");
  });

  test("reports duplicate series order", () => {
    expect(() =>
      validateDocuments([
        ...createValidDocuments(),
        createDocument("ko", "series-one", {
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("en", "series-one", {
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("ko", "series-two", {
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("en", "series-two", {
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
      ]),
    ).toThrow("Duplicate series order: ko:domain-driven-design:1");
  });

  test("reports inconsistent localized metadata", () => {
    const documents = replaceDocuments(
      ({ metadata }) => metadata.locale === "en" && metadata.id === "overview",
      (document) => ({
        ...document,
        metadata: { ...document.metadata, status: "deprecated" },
      }),
    );
    expect(() => validateDocuments(documents)).toThrow(
      'Document overview has inconsistent "status" across locales',
    );
  });

  test("reports inconsistent Diátaxis document kinds", () => {
    const documents = replaceDocuments(
      ({ metadata }) => metadata.id === "overview",
      (document) => ({
        ...document,
        metadata: {
          ...document.metadata,
          documentKind:
            document.metadata.locale === "ko" ? "tutorial" : "reference",
        },
      }),
    );
    expect(() => validateDocuments(documents)).toThrow(
      'Document overview has inconsistent "documentKind" across locales',
    );
  });

  test("requires a Diátaxis kind in the migrated frontend series", () => {
    expect(() =>
      validateDocuments([
        ...createValidDocuments(),
        createDocument("ko", "frontend-doc", {
          series: "frontend-maintainability",
          seriesOrder: 1,
        }),
        createDocument("en", "frontend-doc", {
          series: "frontend-maintainability",
          seriesOrder: 1,
        }),
      ]),
    ).toThrow(
      "ko/frontend-doc.mdx: frontend-maintainability documents require documentKind",
    );
  });

  test("reports extracted broken internal links", () => {
    const documents = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        extractedReferences: [{ href: "/en/missing#section" }],
      }),
    );
    expect(() => validateDocuments(documents)).toThrow(
      "broken internal link /en/missing",
    );
  });

  test("rejects blocking TODO comments only in published prose", () => {
    const published = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: "{/* TODO: complete this before publication */}",
      }),
    );
    expect(() => validateDocuments(published)).toThrow(
      "ko/overview.mdx: published document contains a blocking TODO comment",
    );

    const draft = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: "{/* TODO: draft work */}",
        metadata: { ...document.metadata, publicationStatus: "draft" },
      }),
    );
    expect(() => validateDocuments(draft)).not.toThrow();
  });
});

describe("validateInvestmentNotes", () => {
  test("accepts a complete localized fixture", () => {
    expect(() =>
      validateInvestmentNotes(createValidInvestmentNotes()),
    ).not.toThrow();
  });

  test("reports entry and localization contract failures", () => {
    expect(() =>
      validateInvestmentNotes([
        createInvestmentNote("ko"),
        { ...createInvestmentNote("en"), relativePath: "en/notes/wrong.mdx" },
      ]),
    ).toThrow("expected en/notes/durable-investing.mdx");

    expect(() =>
      validateInvestmentNotes([
        createInvestmentNote("ko"),
        createInvestmentNote("en", { tags: ["different"] }),
      ]),
    ).toThrow("inconsistent shared metadata");
  });

  test("validates bodies only when the caller has loaded them", () => {
    const notes = createValidInvestmentNotes().map((note) => ({
      ...note,
      body: "",
    }));
    expect(() => validateInvestmentNotes(notes)).toThrow(
      "must contain one <SourceSummary> section",
    );
    expect(() => validateInvestmentNotes(notes, false)).not.toThrow();
  });
});
