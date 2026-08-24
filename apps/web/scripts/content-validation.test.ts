// @ts-nocheck
import { describe, expect, test } from "vitest";
import type { DocMetadata, DocSection, Locale } from "../lib/content-model.ts";
import type { SourceDocument } from "./content-source.ts";
import { validateDocuments } from "./content-validation.ts";

function createDocument(
  locale: Locale,
  section: DocSection,
  overrides: Partial<DocMetadata> = {},
): SourceDocument {
  const id =
    section === "overview" ? "overview" : `${section}/${section}-introduction`;
  const metadata: DocMetadata = {
    id,
    locale,
    section,
    title: `${locale} ${section}`,
    description: `${locale} ${section} description`,
    order: 0,
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
    outline: [],
    relativePath: `${locale}/${metadata.id}.mdx`,
  };
}

function createValidDocuments(): readonly SourceDocument[] {
  return (["ko", "en"] as const).flatMap((locale) =>
    (["overview", "handbook", "deep-dive"] as const).map((section) =>
      createDocument(locale, section),
    ),
  );
}

function replaceDocuments(
  predicate: (document: SourceDocument) => boolean,
  update: (document: SourceDocument) => SourceDocument,
): readonly SourceDocument[] {
  return createValidDocuments().map((document) =>
    predicate(document) ? update(document) : document,
  );
}

describe("validateDocuments", () => {
  test("accepts a complete localized navigation fixture", () => {
    expect(() => validateDocuments(createValidDocuments())).not.toThrow();
  });

  test("reports a missing locale pair", () => {
    const documents = createValidDocuments().filter(
      ({ metadata }) =>
        !(metadata.locale === "en" && metadata.id === "overview"),
    );
    expect(() => validateDocuments(documents)).toThrow(
      "Document overview is missing locales: en",
    );
  });

  test("reports duplicate series order", () => {
    expect(() =>
      validateDocuments([
        ...createValidDocuments(),
        createDocument("ko", "handbook", {
          id: "series-one",
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("en", "handbook", {
          id: "series-one",
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("ko", "handbook", {
          id: "series-two",
          series: "domain-driven-design",
          seriesOrder: 1,
        }),
        createDocument("en", "handbook", {
          id: "series-two",
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

  test("reports a broken internal link", () => {
    const documents = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: "[missing](/en/articles/missing)",
      }),
    );
    expect(() => validateDocuments(documents)).toThrow(
      "broken internal link /en/articles/missing",
    );
  });

  test("rejects blocking TODO comments in published documents", () => {
    const documents = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: "{/* TODO: complete this before publication */}",
      }),
    );
    expect(() => validateDocuments(documents)).toThrow(
      "ko/overview.mdx: published document contains a blocking TODO comment",
    );
  });

  test("allows draft markers and TODO examples in code or quotes", () => {
    const draft = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: "{/* TODO: draft work */}",
        metadata: {
          ...document.metadata,
          publicationStatus: "draft",
        },
      }),
    );
    const examples = replaceDocuments(
      ({ metadata }) => metadata.locale === "ko" && metadata.id === "overview",
      (document) => ({
        ...document,
        body: [
          "```mdx",
          "{/* TODO: code example */}",
          "```",
          "> {/* TODO: quoted example */}",
        ].join("\n"),
      }),
    );

    expect(() => validateDocuments(draft)).not.toThrow();
    expect(() => validateDocuments(examples)).not.toThrow();
  });
});
