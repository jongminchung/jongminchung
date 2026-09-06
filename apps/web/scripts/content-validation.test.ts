import { describe, expect, test } from "bun:test";
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
  overrides: Partial<Extract<DocsPageMetadata, { documentKind: string }>> = {},
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
    body: `## ${locale} durable investing\n\nArticle body`,
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

  test("새 번역 쌍을 추가해도 콘텐츠 개수를 고정하지 않음", () => {
    const posts = Array.from({ length: 35 }, (_, index) =>
      (["ko", "en"] as const).map((locale) =>
        createBlogPost(locale, `post-${index}`),
      ),
    ).flat();
    const pages = (["ko", "en"] as const).flatMap((locale) =>
      (["rke2spray", "fe", "be", "k8s", "vscode"] as const).map((area) =>
        createDocsPage(locale, `${area}-article`, { area }),
      ),
    );
    expect(() =>
      validateTechContent(posts, pages, { requireAreas: true }),
    ).not.toThrow();
    expect(() =>
      validateTechContent(posts, localizedDocsPages(), { requireAreas: true }),
    ).toThrow("missing area");
  });

  test("공개 문서에서 초안 링크는 거부하고 초안 간 링크는 허용함", () => {
    const drafts = localizedDocsPages().map((page) => ({
      ...page,
      metadata: { ...page.metadata, publicationStatus: "draft" as const },
    }));
    const posts = localizedBlogPosts().map((post) => ({
      ...post,
      extractedReferences: [
        { href: `/${post.metadata.locale}/docs/fe/docs-page#section` },
      ],
    }));
    expect(() => validateTechContent(posts, drafts)).toThrow(
      "broken internal link",
    );
    expect(() =>
      validateTechContent(posts, localizedDocsPages()),
    ).not.toThrow();
    expect(() =>
      validateTechContent(
        posts.map((post) => ({
          ...post,
          metadata: { ...post.metadata, publicationStatus: "draft" as const },
        })),
        drafts,
      ),
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

  test("일반 Markdown을 허용하고 과거 구분 wrapper를 거부함", () => {
    const legacy = notes().map((note) => ({
      ...note,
      body: "<SourceSummary>Source</SourceSummary>",
    }));
    expect(() => validateInvestmentNotes(legacy)).toThrow(
      "must use ordinary Markdown",
    );
    expect(() => validateInvestmentNotes(legacy, false)).not.toThrow();
  });
});
