import { describe, expect, it } from "vitest";
import {
    compactTestResult,
    summarizeResults,
} from "./compact-playwright-reporter.mjs";

function fakeTest(outcome: "expected" | "unexpected" | "flaky" | "skipped") {
    return {
        id: "test-id",
        location: { file: "/workspace/tests/app.spec.ts", line: 42 },
        outcome: () => outcome,
        titlePath: () => ["", "app.spec.ts", "restores project focus"],
    };
}

describe("compact Playwright reporter", () => {
    it("keeps failure contracts small while retaining artifact paths", () => {
        const result = compactTestResult(
            fakeTest("unexpected"),
            {
                attachments: [
                    {
                        name: "trace",
                        contentType: "application/zip",
                        path: "/workspace/test-results/trace.zip",
                    },
                ],
                duration: 125,
                error: {
                    message: "\u001B[31mfocus mismatch\u001B[39m",
                    stack: "stack",
                },
                errors: [],
            },
            "/workspace",
        );

        expect(result).toMatchObject({
            title: "restores project focus",
            file: "tests/app.spec.ts",
            line: 42,
            outcome: "unexpected",
            durationMs: 125,
            message: "focus mismatch",
            artifacts: [{ name: "trace", path: "test-results/trace.zip" }],
        });
    });

    it("summarizes final outcomes without test logs", () => {
        expect(
            summarizeResults([
                { outcome: "expected" },
                { outcome: "unexpected" },
                { outcome: "flaky" },
                { outcome: "skipped" },
            ]),
        ).toEqual({ passed: 1, failed: 1, flaky: 1, skipped: 1 });
    });
});
