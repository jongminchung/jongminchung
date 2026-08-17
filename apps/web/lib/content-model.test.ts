import { describe, expect, it } from "vitest";
import { parseDocMetadata, searchDocumentSchema } from "./content-model";

const validMetadata = {
    id: "overview",
    locale: "en",
    section: "overview",
    title: "Overview",
    description: "Documentation overview",
    order: 0,
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-14",
    tags: ["docs"],
    status: "stable",
    publicationStatus: "published",
    sourceUrl: "https://example.com/source",
};

describe("ParseDoc메타데이터", () => {
    it("[성공] 불변의 검증된 문서 계약을 반환함", () => {
        const metadata = parseDocMetadata({
            ...validMetadata,
            apiSymbols: ["example#run"],
            displayTitle: "Overview",
            verifiedAt: "2026-07-14",
        });
        expect(metadata).toMatchObject({
            ...validMetadata,
            displayTitle: "Overview",
            verifiedAt: "2026-07-14",
        });
        expect(Object.isFrozen(metadata)).toBe(true);
        expect(Object.isFrozen(metadata.tags)).toBe(true);
        expect(Object.isFrozen(metadata.apiSymbols)).toBe(true);
    });

    it("[실패] 지원되지 않는 로케일, 필드, ID 및 섹션을 포함함", () => {
        expect(() =>
            parseDocMetadata({ ...validMetadata, locale: "fr" }),
        ).toThrow('unsupported locale "fr"');
        expect(() =>
            parseDocMetadata({ ...validMetadata, typo: true }),
        ).toThrow("unsupported metadata fields: typo");
        expect(() =>
            parseDocMetadata({ ...validMetadata, id: "Overview" }),
        ).toThrow("must be a lowercase path");
        expect(() =>
            parseDocMetadata({
                ...validMetadata,
                id: "packages/tooling",
                section: "handbook",
            }),
        ).toThrow('does not belong to section "handbook"');
    });

    it.each(["14-07-2026", "2026-02-29", "2026-04-31"])(
        "[실패] 떠난 데이트 %s을(를) 가지고 있음",
        (updatedAt) => {
            expect(() =>
                parseDocMetadata({ ...validMetadata, updatedAt }),
            ).toThrow("must use the ISO date format");
        },
    );

    it("[실패] 윤일을 허용하고 업데이트 전 확인을 받고 있음", () => {
        expect(
            parseDocMetadata({
                ...validMetadata,
                publishedAt: "2024-02-29",
                updatedAt: "2024-02-29",
                verifiedAt: "2024-02-29",
            }).verifiedAt,
        ).toBe("2024-02-29");
        expect(() =>
            parseDocMetadata({
                ...validMetadata,
                updatedAt: "2026-07-14",
                verifiedAt: "2026-07-13",
            }),
        ).toThrow('must not precede "updatedAt"');
    });

    it.each([
        "http://example.com/source",
        "https://user:secret@example.com/source",
        "javascript:alert(1)",
    ])("[실패] 안전하지 않은 소스 URL %s을(를) 가지고 있음", (sourceUrl) => {
        expect(() => parseDocMetadata({ ...validMetadata, sourceUrl })).toThrow(
            /absolute URL|credential-free HTTPS URL/u,
        );
    });

    it("[실패] 아무것도 없고 데이터 배열을 포함했습니다", () => {
        expect(() => parseDocMetadata({ ...validMetadata, tags: [] })).toThrow(
            "must be an array of strings",
        );
        expect(() =>
            parseDocMetadata({ ...validMetadata, tags: ["docs", " docs "] }),
        ).toThrow("must not contain duplicates");
        expect(() =>
            parseDocMetadata({ ...validMetadata, apiSymbols: [""] }),
        ).toThrow("must not contain empty strings");
    });

    it("[성공]으로 생성된 검색 문서를 검증함", () => {
        const document = {
            id: "overview",
            locale: "en",
            section: "overview",
            title: "Overview",
            description: "Documentation overview",
            order: 0,
            href: "/en",
            headings: ["Start"],
            tags: ["docs"],
            apiSymbols: [],
            body: "Overview body",
        };

        expect(searchDocumentSchema.parse(document)).toEqual(document);
        expect(() =>
            searchDocumentSchema.parse({ ...document, unexpected: true }),
        ).toThrow();
        expect(() =>
            searchDocumentSchema.parse({ ...document, locale: "fr" }),
        ).toThrow();
    });
});
