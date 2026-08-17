import { describe, expect, it } from "vitest";
import { documents, findDocument, rankRelatedDocuments } from "./documents";
import { findSectionPage } from "./section-pages";

function requireDocument(locale: string, id: string) {
    const document = findDocument(locale, id);
    if (document === null)
        throw new Error(`Missing test document ${locale}/${id}.`);
    return document;
}

describe("문서 발견", () => {
    it("[성공] 업데이트 휴가 휴가 목록", () => {
        const page = findSectionPage("ko", "deep-dive");
        expect(page).not.toBeNull();
        expect(page?.documents.map(({ id }) => id)).toEqual([
            "deep-dive/typescript-7-compatibility",
            "deep-dive/server-monitoring-analysis-guide",
            "deep-dive/nextjs-16",
            "deep-dive/pnpm-11",
            "deep-dive/node-26",
            "deep-dive/typescript-6",
            "deep-dive/the-expensive-main-thread",
            "deep-dive/building-3d-illusion-game",
            "deep-dive/building-coding-agent",
            "deep-dive/building-email-relay-system",
            "deep-dive/frontend-caching-strategies",
            "deep-dive/hamssun-python-lisp",
            "deep-dive/headless-react-component",
            "deep-dive/react-component-based-thinking",
            "deep-dive/beyond-beautiful-code",
            "deep-dive/building-calculator-engine",
            "deep-dive/building-nes-emulator",
            "deep-dive/encrypted-share-vault-system",
            "deep-dive/how-to-whittle-a-skill",
            "deep-dive/implementing-genetic-algorithm",
            "deep-dive/building-llm",
            "deep-dive/do-we-really-know-pagination",
            "deep-dive/the-weight-of-trivial-code",
            "deep-dive/throughput-and-latency",
            "deep-dive/feeling-claude-blue",
            "deep-dive/it-is-the-boundary-stupid",
            "deep-dive/how-to-design-animation",
            "deep-dive/modeling-series-view-model",
            "deep-dive/ascii-3d-renderer",
        ]);
        expect(findSectionPage("ko", "overview")).toBeNull();
    });

    it("[성공] 같은 섹션 폴백 이전에 공유 태그의 순위를 결정적으로 결정함", () => {
        const current = requireDocument("en", "deep-dive/typescript-6");
        expect(
            rankRelatedDocuments(current, documents).map(({ id }) => id),
        ).toEqual([
            "deep-dive/typescript-7-compatibility",
            "deep-dive/node-26",
            "deep-dive/building-calculator-engine",
        ]);
    });

    it("[성공] 태그가 외부 옆에 있는 문서를 사용함", () => {
        const current = requireDocument(
            "ko",
            "deep-dive/server-monitoring-analysis-guide",
        );
        expect(
            rankRelatedDocuments(current, documents).map(({ id }) => id),
        ).toEqual([
            "deep-dive/feeling-claude-blue",
            "deep-dive/it-is-the-boundary-stupid",
            "deep-dive/building-email-relay-system",
        ]);
    });
});
