import { describe, expect, it, vi } from "vitest";
import { sampleRepository } from "../../../domain/sampleData";
import {
    buildFixtureHistoryRewritePreview,
    buildFixturePushPreview,
} from "./buildFixturePreviews";

describe("비중보기 사용현황", () => {
    it("[실패] 라이브 백엔드를 반대하지 않는 다양한 대상을 모델함", () => {
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

    it("[성공] 기록에서 재작성 항목 및 게시 상태를 분류함", () => {
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

    it("[성공] 기록 재작성 미리보기를 위해 개방형이 필요함", () => {
        expect(() =>
            buildFixtureHistoryRewritePreview({
                repository: null,
                fromRevision: "HEAD",
            }),
        ).toThrow("Open a repository first");
    });
});
