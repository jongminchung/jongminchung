import { describe, expect, it } from "vitest";
import { getLocalizedDocuments } from "../documents";
import {
  createDocsHref,
  docsCategoryIds,
  documentsForDocsCategory,
  groupDocsDocuments,
  isDocsCategoryId,
} from "./docs";

describe("기술 문서 카테고리", () => {
  it("[성공] FE와 K8s 문서를 등록 순서대로 제공함", async () => {
    const documents = await getLocalizedDocuments("ko");
    expect(docsCategoryIds).toEqual(["fe", "k8s"]);
    expect(documentsForDocsCategory(documents, "fe").length).toBeGreaterThan(4);
    expect(
      documentsForDocsCategory(documents, "k8s").every((document) =>
        document.tags.some((tag) => ["kubernetes", "cilium"].includes(tag)),
      ),
    ).toBe(true);
  });

  it("[성공] 카테고리 문서를 중복 없이 탐색 섹션으로 묶음", async () => {
    const documents = await getLocalizedDocuments("en");
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
    const documents = await getLocalizedDocuments("ko");
    const testing = groupDocsDocuments(documents, "fe", "ko").find(
      ({ id }) => id === "testing",
    );

    expect(testing?.label).toBe("테스트와 품질");
    expect(testing?.documents.map(({ id }) => id)).toContain(
      "playwright-visual-regression-testing",
    );
  });

  it("[성공] 허브·카테고리·본문 URL을 한 계약으로 생성함", () => {
    expect(createDocsHref("ko")).toBe("/ko/docs");
    expect(createDocsHref("ko", "fe")).toBe("/ko/docs/fe");
    expect(createDocsHref("ko", "fe", "react-component-based-thinking")).toBe(
      "/ko/docs/fe/react-component-based-thinking",
    );
    expect(isDocsCategoryId("k8s")).toBe(true);
    expect(isDocsCategoryId("backend")).toBe(false);
  });
});
