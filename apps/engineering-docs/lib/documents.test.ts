import { describe, expect, it } from "vitest";
import { documents, findDocument, rankRelatedDocuments } from "./documents";
import { findSectionPage } from "./section-pages";

function requireDocument(locale: string, id: string) {
  const document = findDocument(locale, id);
  if (document === null) throw new Error(`Missing test document ${locale}/${id}.`);
  return document;
}

describe("documentation discovery", () => {
  it("orders section landings by update date, then navigation order", () => {
    const page = findSectionPage("ko", "deep-dive");
    expect(page).not.toBeNull();
    expect(page?.documents.map(({ id }) => id)).toEqual([
      "deep-dive/typescript-7-compatibility",
      "deep-dive/server-monitoring-analysis-guide",
      "deep-dive/nextjs-16",
      "deep-dive/pnpm-11",
      "deep-dive/node-26",
      "deep-dive/typescript-6",
    ]);
    expect(findSectionPage("ko", "overview")).toBeNull();
  });

  it("ranks shared tags before same-section fallbacks deterministically", () => {
    const current = requireDocument("en", "packages/tooling");
    expect(rankRelatedDocuments(current, documents).map(({ id }) => id)).toEqual([
      "deep-dive/typescript-7-compatibility",
      "deep-dive/pnpm-11",
      "packages/remark-plantuml",
    ]);
  });

  it("uses nearby section documents when no tags overlap", () => {
    const current = requireDocument("ko", "deep-dive/server-monitoring-analysis-guide");
    expect(rankRelatedDocuments(current, documents).map(({ id }) => id)).toEqual([
      "deep-dive/typescript-7-compatibility",
      "deep-dive/typescript-6",
      "deep-dive/node-26",
    ]);
  });
});
