import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import {
    createSectionHref,
    locales,
    sectionLandingSections,
} from "../lib/content-model";
import { GET } from "./(tech)/sites/tech/llms.txt/route";

describe("llms.txt", () => {
    it("publishes every localized document and section landing in the proposed format", async () => {
        const response = GET();
        const body = await response.text();

        expect(response.headers.get("content-type")).toBe(
            "text/plain; charset=utf-8",
        );
        expect(body).toMatch(/^# Engineering Notes\n\n> /u);
        expect(body).not.toContain("undefined");

        for (const document of manifest) {
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
