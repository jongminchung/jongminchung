import { describe, expect, test } from "vitest";
import { createOutline, createSearchBody } from "./content-source.ts";

describe("content source normalization", () => {
    test("collects stable h2 and h3 outline entries", async () => {
        await expect(
            createOutline("# Title\n\n## First section\n\n### Detail"),
        ).resolves.toEqual([
            { id: "first-section", label: "First section", level: 2 },
            { id: "detail", label: "Detail", level: 3 },
        ]);
    });

    test("removes markup and fenced code from searchable prose", () => {
        expect(
            createSearchBody(
                "## Visible title\n\nRead **this**.\n\n```ts\nhiddenCode()\n```",
            ),
        ).toBe("Visible title Read this .");
    });
});
