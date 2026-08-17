import { describe, expect, it } from "vitest";
import {
    createSectionHref,
    locales,
    sectionLandingSections,
} from "../lib/content-model";
import { getDocuments } from "../lib/documents";
import { GET } from "./(tech)/sites/tech/llms.txt/route";

describe("llms.txt", () => {
    it("[성공] 모든 내부 문서와 섹션 소개를 제안된 형식으로 게시함", async () => {
        const response = await GET();
        const body = await response.text();

        expect(response.headers.get("content-type")).toBe(
            "text/plain; charset=utf-8",
        );
        expect(body).toMatch(/^# Engineering Notes\n\n> /u);
        expect(body).not.toContain("undefined");

        for (const document of await getDocuments()) {
            const link = `](https://tech.jamie.kr${document.href})`;
            expect(body.split(link)).toHaveLength(2);
        }
        for (const locale of locales) {
            for (const section of sectionLandingSections) {
                expect(body).toContain(
                    `](https://tech.jamie.kr${createSectionHref(locale, section)})`,
                );
            }
        }
    });
});
