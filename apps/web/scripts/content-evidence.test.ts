import { describe, expect, it } from "vitest";
import { assessFreshness, freshnessPolicyFor } from "./content-evidence.ts";

const base = {
    section: "deep-dive" as const,
    sourceUrl: "https://example.com/docs/api",
};

describe("content evidence", () => {
    it("[성공] 문서 성격별 freshness policy를 선택함", () => {
        expect(freshnessPolicyFor({ ...base, packageName: "typescript" })).toBe(
            "versioned-technology",
        );
        expect(freshnessPolicyFor({ ...base, packageName: undefined })).toBe(
            "upstream-api",
        );
        expect(
            freshnessPolicyFor({
                ...base,
                packageName: undefined,
                section: "handbook",
            }),
        ).toBe("repository-handbook");
    });

    it("[성공] threshold 경계와 미검증 문서를 구분함", () => {
        const now = new Date("2026-08-20T00:00:00Z");
        expect(
            assessFreshness(
                {
                    ...base,
                    packageName: "typescript",
                    verifiedAt: "2026-05-22",
                },
                now,
            ).stale,
        ).toBe(false);
        expect(
            assessFreshness(
                {
                    ...base,
                    packageName: "typescript",
                    verifiedAt: "2026-05-21",
                },
                now,
            ).stale,
        ).toBe(true);
        expect(
            assessFreshness(
                { ...base, packageName: undefined, verifiedAt: undefined },
                now,
            ),
        ).toMatchObject({ ageDays: null, stale: true });
    });
});
