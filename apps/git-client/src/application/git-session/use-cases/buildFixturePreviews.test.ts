import { describe, expect, it, vi } from "vitest";
import { sampleRepository } from "../../../domain/sampleData";
import {
    buildFixtureHistoryRewritePreview,
    buildFixturePushPreview,
} from "./buildFixturePreviews";

describe("fixture preview use cases", () => {
    it("models a diverged destination without consulting a live backend", () => {
        vi.spyOn(Date, "now").mockReturnValue(42);

        const preview = buildFixturePushPreview({
            snapshot: sampleRepository.snapshot,
            remote: "upstream",
            remoteRef: "refs/heads/diverged",
            localRevision: "HEAD",
        });

        expect(preview).toMatchObject({
            remote: "upstream",
            remoteRef: "refs/heads/diverged",
            ahead: 2,
            behind: 1,
            fastForward: false,
            checkedAtMs: 42,
        });
        expect(preview.remoteOnlyCommits).toHaveLength(1);
        expect(preview.warnings).toHaveLength(1);
    });

    it("derives rewrite entries and publication state from repository history", () => {
        const preview = buildFixtureHistoryRewritePreview({
            repository: {
                snapshot: sampleRepository.snapshot,
                commits: sampleRepository.commits,
                ahead: sampleRepository.status.ahead,
            },
            fromRevision: sampleRepository.commits.at(-1)?.oid ?? "HEAD",
        });

        expect(preview.branch).toBe(
            sampleRepository.snapshot.currentBranch ?? "main",
        );
        expect(preview.descendantCount).toBeGreaterThan(0);
        expect(preview.entries).toHaveLength(preview.descendantCount);
        expect(preview.entries.every((entry) => entry.action === "pick")).toBe(
            true,
        );
    });

    it("requires an open repository for history rewrite previews", () => {
        expect(() =>
            buildFixtureHistoryRewritePreview({
                repository: null,
                fromRevision: "HEAD",
            }),
        ).toThrow("Open a repository first");
    });
});
