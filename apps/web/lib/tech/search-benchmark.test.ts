import { describe, expect, it } from "vitest";
import {
    createSearchDocuments,
    readContentSnapshot,
} from "../content-repository";
import {
    assertSearchBenchmarkThresholds,
    evaluateSearchBenchmark,
    measureSearchIndexCost,
    searchDocuments,
} from "./search";
import {
    bilingualSearchBenchmarkBaseline,
    bilingualSearchBenchmarkCases,
    bilingualSearchBenchmarkThresholds,
} from "./search-benchmark";

describe("한영 검색 relevance benchmark", () => {
    it("[성공] 실제 40개 corpus가 relevance와 index 비용 예산을 충족함", async () => {
        const snapshot = await readContentSnapshot();
        const documents = [
            ...createSearchDocuments(
                snapshot.documents,
                snapshot.sources,
                "en",
            ),
            ...createSearchDocuments(
                snapshot.documents,
                snapshot.sources,
                "ko",
            ),
        ];
        const report = evaluateSearchBenchmark(
            documents,
            bilingualSearchBenchmarkCases,
        );
        const englishReport = evaluateSearchBenchmark(
            documents,
            bilingualSearchBenchmarkCases.filter(
                (benchmark) => benchmark.locale === "en",
            ),
        );
        const koreanReport = evaluateSearchBenchmark(
            documents,
            bilingualSearchBenchmarkCases.filter(
                (benchmark) => benchmark.locale === "ko",
            ),
        );
        const cost = measureSearchIndexCost(documents);

        expect(bilingualSearchBenchmarkCases).toHaveLength(40);
        expect(report).toMatchObject({
            queries: 40,
            positiveQueries: 36,
            noResultQueries: 4,
            zeroResultRate: 0.1,
            noResultAccuracy: 1,
            unexpectedZeroResultRate: 0,
        });
        expect(report).toMatchObject(
            bilingualSearchBenchmarkBaseline.aggregate,
        );
        expect(englishReport).toMatchObject(
            bilingualSearchBenchmarkBaseline.en,
        );
        expect(koreanReport).toMatchObject(bilingualSearchBenchmarkBaseline.ko);
        expect(cost).toMatchObject({
            engine: "built-in",
            indexBytes: bilingualSearchBenchmarkBaseline.index.bytes,
            initialRequestCount:
                bilingualSearchBenchmarkBaseline.index.initialRequestCount,
            runtimeDependencyBytes:
                bilingualSearchBenchmarkBaseline.index.runtimeDependencyBytes,
        });
        for (const localeReport of [report, englishReport, koreanReport]) {
            expect(() =>
                assertSearchBenchmarkThresholds(
                    localeReport,
                    cost,
                    bilingualSearchBenchmarkThresholds,
                ),
            ).not.toThrow();
        }
    });

    it("[성공] 부분 일치와 명시적인 결과 없음 query를 구분함", async () => {
        const snapshot = await readContentSnapshot();
        const ko = createSearchDocuments(
            snapshot.documents,
            snapshot.sources,
            "ko",
        );

        expect(searchDocuments(ko, "React 컴포넌트 경계")).not.toHaveLength(0);
        expect(searchDocuments(ko, "양자컴퓨팅큐비트얽힘")).toHaveLength(0);
    });
});
