import { describe, expect, it } from "vitest";
import {
    createSectionHref,
    locales,
    sectionLandingSections,
} from "../lib/content-model";
import { getDocuments } from "../lib/documents";
import { GET as getRobots } from "./(tech)/sites/tech/robots.txt/route";
import sitemap from "./(tech)/sites/tech/sitemap";

describe("문서가 현재 위치에 있음", () => {
    it("[성공] 모든 내부 문서 및 섹션 임대를 생성함", async () => {
        const [entries, manifest] = await Promise.all([
            sitemap(),
            getDocuments(),
        ]);
        const documentEntries = entries.slice(0, manifest.length);
        expect(documentEntries.map(({ url }) => url)).toEqual(
            manifest.map(({ href }) => `https://tech.jamie.kr${href}`),
        );

        for (const entry of documentEntries) {
            const document = manifest.find(
                ({ href }) => `https://tech.jamie.kr${href}` === entry.url,
            );
            if (document === undefined)
                throw new Error(`Missing sitemap source for ${entry.url}.`);
            expect(entry.lastModified).toBe(document.updatedAt);
            expect(entry.alternates?.languages).toEqual({
                ko: `https://tech.jamie.kr${manifest.find(({ id, locale }) => id === document.id && locale === "ko")?.href}`,
                en: `https://tech.jamie.kr${manifest.find(({ id, locale }) => id === document.id && locale === "en")?.href}`,
            });
        }

        const sectionEntries = entries.slice(manifest.length);
        expect(sectionEntries.map(({ url }) => url)).toEqual(
            locales.flatMap((locale) =>
                sectionLandingSections.map(
                    (section) =>
                        `https://tech.jamie.kr${createSectionHref(locale, section)}`,
                ),
            ),
        );
        for (const entry of sectionEntries) {
            expect(entry.alternates?.languages).toEqual({
                ko: entry.url.replace(/\/en\//u, "/ko/"),
                en: entry.url.replace(/\/ko\//u, "/en/"),
            });
        }
    });

    it("[성공] 생성된 사이트 맵을 크롤러에 게시함", async () => {
        const response = getRobots();
        expect(await response.text()).toContain(
            "Sitemap: https://tech.jamie.kr/sitemap.xml",
        );
    });
});
