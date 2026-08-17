import { describe, expect, it } from "vitest";
import type {
    CurrentNavigationEntry,
    NavigationEntry,
} from "#lib/content-model";
import { documentsForSection, sectionNavigationItems } from "./tech-navigation";

const documents: readonly NavigationEntry[] = [
    {
        id: "overview",
        href: "/en",
        section: "overview",
        title: "Overview",
    },
    {
        id: "ddd",
        href: "/en/articles/ddd",
        section: "handbook",
        title: "DDD",
    },
] as const;

describe("sectionNavigationItems", () => {
    it("uses an outline for a section with one current document", () => {
        const current: CurrentNavigationEntry = {
            kind: "document",
            id: "ddd",
            href: "/en/articles/ddd",
            title: "DDD",
            section: "handbook",
            outline: [
                { id: "intro", label: "Introduction", level: 2 },
                { id: "detail", label: "Detail", level: 3 },
            ],
        };
        expect(sectionNavigationItems(current, documents)).toEqual([
            {
                id: "intro",
                href: "#intro",
                label: "Introduction",
                selected: false,
            },
        ]);
    });

    it("keeps section landing items unselected and alternate sections unselected", () => {
        const current: CurrentNavigationEntry = {
            kind: "section",
            id: "handbook",
            href: "/en/series/handbook",
            title: "Handbook",
            section: "handbook",
        };
        expect(sectionNavigationItems(current, documents)[0]).toMatchObject({
            id: "ddd",
            selected: false,
        });
        expect(documentsForSection(documents, "overview")[0]).toMatchObject({
            id: "overview",
            selected: false,
        });
    });
});
