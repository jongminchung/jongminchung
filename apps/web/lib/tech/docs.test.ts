import { describe, expect, it } from "vitest";
import { getLocalizedDocsPages } from "../documents";
import {
  createDocsHref,
  docsCategoryIds,
  documentsForDocsCategory,
  groupDocsDocuments,
  isDocsCategoryId,
} from "./docs";

describe("기술 문서 카테고리", () => {
  it("[성공] 다섯 Docs 영역을 등록 순서대로 제공함", async () => {
    const documents = await getLocalizedDocsPages("ko");
    expect(docsCategoryIds).toEqual([
      "fe",
      "k8s",
      "architecture",
      "tooling",
      "practices",
    ]);
    expect(documentsForDocsCategory(documents, "fe").length).toBeGreaterThan(4);
    expect(
      documentsForDocsCategory(documents, "k8s").every(
        (document) => document.area === "k8s",
      ),
    ).toBe(true);
  });

  it("[성공] 카테고리 문서를 중복 없이 탐색 섹션으로 묶음", async () => {
    const documents = await getLocalizedDocsPages("en");
    const expected = documentsForDocsCategory(documents, "fe");
    const grouped = groupDocsDocuments(documents, "fe", "en").flatMap(
      ({ documents: entries }) => entries,
    );
    expect(grouped.map(({ id }) => id).toSorted()).toEqual(
      expected.map(({ id }) => id).toSorted(),
    );
    expect(new Set(grouped.map(({ id }) => id)).size).toBe(grouped.length);
  });

  it("[성공] Playwright 시각 회귀 안내서를 FE 문서로 분류함", async () => {
    const documents = await getLocalizedDocsPages("ko");
    const testing = groupDocsDocuments(documents, "fe", "ko").find(
      ({ id }) => id === "how-to",
    );

    expect(testing?.label).toBe("How-to · 작업");
    expect(testing?.documents.map(({ id }) => id)).toContain(
      "playwright-visual-regression-testing",
    );
  });

  it("[성공] 허브·카테고리·본문 URL을 한 계약으로 생성함", () => {
    expect(createDocsHref("ko")).toBe("/ko/docs");
    expect(createDocsHref("ko", "fe")).toBe("/ko/docs/fe");
    expect(createDocsHref("ko", "fe", "nextjs-16")).toBe(
      "/ko/docs/fe/nextjs-16",
    );
    expect(isDocsCategoryId("k8s")).toBe(true);
    expect(isDocsCategoryId("backend")).toBe(false);
  });
});
