import { describe, expect, it } from "vitest";
import {
    parseInvestmentNoteMetadata,
    validateInvestmentNoteBody,
} from "./investment-content";

const metadata = {
    id: "margin-of-safety",
    locale: "en",
    title: "Margin of Safety",
    description: "A source-grounded note",
    publishedAt: "2026-08-16",
    updatedAt: "2026-08-16",
    status: "published",
    tags: ["risk"],
    sources: [
        {
            kind: "book",
            title: "The Intelligent Investor",
            creator: "Benjamin Graham",
            isbn: "9780060555665",
        },
    ],
} as const;

describe("investment note contract", () => {
    it("accepts a source-grounded bilingual note shape", () => {
        expect(parseInvestmentNoteMetadata(metadata).sources[0]?.kind).toBe(
            "book",
        );
        expect(() =>
            validateInvestmentNoteBody(
                "<SourceSummary>Summary</SourceSummary>\n<JamieNotes>Notes</JamieNotes>",
                "fixture",
            ),
        ).not.toThrow();
    });

    it("requires URLs for non-book sources", () => {
        expect(() =>
            parseInvestmentNoteMetadata({
                ...metadata,
                sources: [
                    { kind: "video", title: "Talk", creator: "Investor" },
                ],
            }),
        ).toThrow(/requires a URL/u);
    });

    it("requires separate source summary and author notes", () => {
        expect(() => validateInvestmentNoteBody("Freeform", "fixture")).toThrow(
            /SourceSummary/u,
        );
    });

    it("rejects unknown fields, duplicate tags, and reversed dates", () => {
        expect(() =>
            parseInvestmentNoteMetadata({ ...metadata, unexpected: true }),
        ).toThrow();
        expect(() =>
            parseInvestmentNoteMetadata({
                ...metadata,
                tags: ["risk", " risk "],
            }),
        ).toThrow(/duplicates/u);
        expect(() =>
            parseInvestmentNoteMetadata({
                ...metadata,
                updatedAt: "2026-08-15",
            }),
        ).toThrow(/precedes/u);
    });

    it("rejects invalid dates and credential-bearing source URLs", () => {
        expect(() =>
            parseInvestmentNoteMetadata({
                ...metadata,
                publishedAt: "2026-02-30",
            }),
        ).toThrow(/invalid publication date/u);
        expect(() =>
            parseInvestmentNoteMetadata({
                ...metadata,
                sources: [
                    {
                        kind: "article",
                        title: "Analysis",
                        creator: "Analyst",
                        url: "https://user:secret@example.com/article",
                    },
                ],
            }),
        ).toThrow(/credential-free HTTPS URL/u);
    });
});
