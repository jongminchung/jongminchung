import { describe, expect, it } from "vitest";
import type { SearchDocument } from "./content-model";
import { scoreSearchDocument, searchDocuments } from "./search";

function createDocument(overrides: Partial<SearchDocument>): SearchDocument {
    return {
        id: "doc",
        locale: "en",
        section: "handbook",
        title: "Package guide",
        description: "A useful guide",
        order: 0,
        href: "/en/articles/guide",
        headings: [],
        tags: [],
        apiSymbols: [],
        body: "",
        ...overrides,
    };
}

describe("문서검색", () => {
    it("[성공] 본문 텍스트의 제목을 일치시키기 위해 부여함", () => {
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

    it("[성공] 탐색 순서에 따라 중요한 API 기호 및 그룹 연결", () => {
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

    it("[성공] 일치하는 제목과 본체 스니펫을 설명으로 돌려보내기", () => {
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
        expect(searchDocuments([bodyMatch], "frozen")[0]?.match.text).toContain(
            "frozen lockfile",
        );
    });
});
