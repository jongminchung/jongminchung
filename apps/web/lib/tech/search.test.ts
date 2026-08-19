import { describe, expect, it } from "vitest";
import type { SearchDocument } from "../content-model";
import {
    evaluateSearchBenchmark,
    scoreSearchDocument,
    searchDocuments,
    tokenizeSearchQuery,
} from "./search";

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

    it("[성공] 한국어 띄어쓰기 차이와 한영 혼합 질의를 처리함", () => {
        const mainThread = createDocument({
            id: "main-thread",
            locale: "ko",
            title: "브라우저의 메인 스레드는 비싸다",
            tags: ["browser", "성능"],
        });
        expect(tokenizeSearchQuery("React 컴포넌트")).toEqual([
            "react",
            "컴포넌트",
        ]);
        expect(
            searchDocuments([mainThread], "메인스레드")[0]?.document.id,
        ).toBe("main-thread");
        expect(
            searchDocuments([mainThread], "browser 메인스레드")[0]?.document.id,
        ).toBe("main-thread");
    });

    it("[성공] benchmark의 top-k, MRR, zero-result 지표를 계산함", () => {
        const documents = [
            createDocument({ id: "package", title: "Package guide" }),
            createDocument({ id: "runtime", title: "Runtime guide" }),
        ];
        expect(
            evaluateSearchBenchmark(documents, [
                { query: "package", expectedIds: ["package"] },
                { query: "runtime", expectedIds: ["runtime"] },
                { query: "missing", expectedIds: [] },
            ]),
        ).toEqual({
            queries: 3,
            top1HitRate: 2 / 3,
            top3HitRate: 2 / 3,
            meanReciprocalRank: 2 / 3,
            zeroResultRate: 1 / 3,
        });
    });
});
