import { describe, expect, it } from "vitest";
import type { SearchDocument } from "./content-model";
import { scoreSearchDocument, searchDocuments } from "./search";

function createDocument(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: "doc",
    locale: "en",
    section: "packages",
    title: "Package guide",
    description: "A useful guide",
    order: 0,
    href: "/en/packages/guide",
    headings: [],
    tags: [],
    apiSymbols: [],
    body: "",
    ...overrides,
  };
}

describe("documentation search", () => {
  it("weights a title match above body text", () => {
    const titleMatch = createDocument({
      id: "title",
      title: "defineTheme",
    });
    const bodyMatch = createDocument({
      id: "body",
      title: "Other",
      body: "defineTheme",
    });
    expect(scoreSearchDocument(titleMatch, "defineTheme")).toBeGreaterThan(
      scoreSearchDocument(bodyMatch, "defineTheme"),
    );
  });

  it("weights API symbols and groups ties by navigation order", () => {
    const laterTitle = createDocument({
      id: "later",
      order: 2,
      title: "Theme",
    });
    const apiMatch = createDocument({
      id: "api",
      order: 1,
      title: "API reference",
      apiSymbols: ["defineTheme"],
    });
    const results = searchDocuments([laterTitle, apiMatch], "defineTheme");
    expect(results.map((result) => result.document.id)).toEqual(["api"]);
    expect(results[0]?.match).toEqual({
      field: "apiSymbol",
      text: "defineTheme",
    });
  });

  it("returns the matched heading and a body snippet as an explanation", () => {
    const headingMatch = createDocument({
      headings: ["Workspace contract"],
    });
    const bodyMatch = createDocument({
      id: "body",
      title: "Runtime guide",
      body: "A reproducible install uses a frozen lockfile in continuous integration.",
    });

    expect(searchDocuments([headingMatch], "workspace")[0]?.match).toEqual({
      field: "heading",
      text: "Workspace contract",
    });
    expect(searchDocuments([bodyMatch], "frozen")[0]?.match).toMatchObject({
      field: "body",
    });
    expect(searchDocuments([bodyMatch], "frozen")[0]?.match.text).toContain("frozen lockfile");
  });
});
