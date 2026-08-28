import { describe, expect, test } from "vitest";
import type {
  BlogPostMetadata,
  DocsPageMetadata,
  Locale,
} from "../lib/content-model.ts";
import {
  validateBlogPosts,
  validateDocsPages,
  validateInvestmentNotes,
  validateTechContent,
  type ValidatedContentSource,
} from "../lib/content-validation.ts";
import type { InvestmentNoteMetadata } from "../lib/invest/content.ts";

function createBlogPost(
  locale: Locale,
  id = "blog-post",
  overrides: Partial<BlogPostMetadata> = {},
): ValidatedContentSource<BlogPostMetadata> {
  const metadata: BlogPostMetadata = {
    id,
    locale,
    title: `${locale} ${id}`,
    description: `${locale} ${id} description`,
    thesis: `${locale} ${id} thesis`,
    counterargument: `${locale} ${id} counterargument`,
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: ["blog"],
    status: "stable",
    publicationStatus: "published",
    sourceUrl: "https://example.com/source",
    ...overrides,
  };
  return {
    metadata,
    body: `## ${metadata.title}\n`,
    filePath: `/fixture/blog/${locale}/${id}.mdx`,
    relativePath: `${locale}/${id}.mdx`,
    extractedReferences: [],
  };
}

function createDocsPage(
  locale: Locale,
  id = "docs-page",
  overrides: Partial<DocsPageMetadata> = {},
): ValidatedContentSource<DocsPageMetadata> {
  const metadata: DocsPageMetadata = {
    id,
    locale,
    area: "fe",
    documentKind: "tutorial",
    title: `${locale} ${id}`,
    description: `${locale} ${id} description`,
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    verifiedAt: "2026-01-01",
    tags: ["docs"],
    status: "stable",
    publicationStatus: "published",
    sourceUrl: "https://example.com/source",
    ...overrides,
  };
  return {
    metadata,
    body: `## ${metadata.title}\n`,
    filePath: `/fixture/docs/${locale}/${metadata.area}/${id}.mdx`,
    relativePath: `${locale}/${metadata.area}/${id}.mdx`,
    extractedReferences: [],
  };
}

function localizedBlogPosts() {
  return (["ko", "en"] as const).map((locale) => createBlogPost(locale));
}

function localizedDocsPages() {
  return (["ko", "en"] as const).map((locale) => createDocsPage(locale));
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
    image: "/invest/durable-investing.png",
    imageAlt: `${locale} durable investing thumbnail`,
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

describe("Blog·Docs 콘텐츠 계약", () => {
  test("분리된 collection의 완전한 번역 쌍을 허용함", () => {
    expect(() => validateBlogPosts(localizedBlogPosts())).not.toThrow();
    expect(() => validateDocsPages(localizedDocsPages())).not.toThrow();
    expect(() =>
      validateTechContent(localizedBlogPosts(), localizedDocsPages()),
    ).not.toThrow();
  });

  test("물리적 경로와 locale 누락을 보고함", () => {
    expect(() =>
      validateBlogPosts([
        { ...createBlogPost("ko"), relativePath: "ko/wrong.mdx" },
        createBlogPost("en"),
      ]),
    ).toThrow("expected path ko/blog-post.mdx");
    expect(() => validateDocsPages([createDocsPage("ko")])).toThrow(
      "Docs page docs-page is missing locales: en",
    );
  });

  test("Docs 한·영 쌍의 area와 Diátaxis 유형 불일치를 거부함", () => {
    expect(() =>
      validateDocsPages([
        createDocsPage("ko"),
        createDocsPage("en", "docs-page", { documentKind: "reference" }),
      ]),
    ).toThrow('inconsistent "documentKind" across locales');
  });

  test("Blog Series 안의 중복 순서를 locale별로 거부함", () => {
    const posts = (["ko", "en"] as const).flatMap((locale) => [
      createBlogPost(locale, "first-post", {
        series: "building-from-first-principles",
        seriesOrder: 1,
      }),
      createBlogPost(locale, "second-post", {
        series: "building-from-first-principles",
        seriesOrder: 1,
      }),
    ]);
    expect(() => validateBlogPosts(posts)).toThrow("Duplicate series order");
  });

  test("Blog와 Docs 사이의 중복 ID와 잘못된 canonical 링크를 거부함", () => {
    expect(() =>
      validateTechContent(localizedBlogPosts(), [
        createDocsPage("ko", "blog-post"),
        createDocsPage("en", "blog-post"),
      ]),
    ).toThrow("Duplicate Blog/Docs ID: blog-post");

    const broken = localizedDocsPages().map((page) =>
      page.metadata.locale === "ko"
        ? { ...page, extractedReferences: [{ href: "/en/missing#section" }] }
        : page,
    );
    expect(() => validateTechContent(localizedBlogPosts(), broken)).toThrow(
      "broken internal link /en/missing",
    );
  });

  test("게시 본문의 blocking TODO만 거부함", () => {
    const published = localizedBlogPosts().map((post) =>
      post.metadata.locale === "ko"
        ? { ...post, body: "{/* TODO: complete before publication */}" }
        : post,
    );
    expect(() => validateBlogPosts(published)).toThrow("blocking TODO");

    const draft = localizedBlogPosts().map((post) =>
      post.metadata.locale === "ko"
        ? {
            ...post,
            body: "{/* TODO: draft work */}",
            metadata: { ...post.metadata, publicationStatus: "draft" as const },
          }
        : post,
    );
    expect(() => validateBlogPosts(draft)).not.toThrow();
  });
});

describe("투자 노트 계약", () => {
  const notes = () =>
    (["ko", "en"] as const).map((locale) => createInvestmentNote(locale));

  test("완전한 번역 쌍을 허용하고 경로 오류를 거부함", () => {
    expect(() => validateInvestmentNotes(notes())).not.toThrow();
    expect(() =>
      validateInvestmentNotes([
        createInvestmentNote("ko"),
        { ...createInvestmentNote("en"), relativePath: "en/notes/wrong.mdx" },
      ]),
    ).toThrow("expected en/notes/durable-investing.mdx");
  });

  test("본문을 로드한 경우에만 필수 섹션을 검증함", () => {
    const empty = notes().map((note) => ({ ...note, body: "" }));
    expect(() => validateInvestmentNotes(empty)).toThrow(
      "must contain one <SourceSummary> section",
    );
    expect(() => validateInvestmentNotes(empty, false)).not.toThrow();
  });
});
