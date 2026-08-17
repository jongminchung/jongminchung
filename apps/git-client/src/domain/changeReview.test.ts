import { describe, expect, it } from "vitest";
import {
    DEFAULT_DIFF_PREFERENCES,
    changeEntries,
    normalizePartialPatchTarget,
    parseChangeSelection,
    parseCommitDraft,
    parseDiffPreferences,
    parseRepositoryViewMode,
    reconcileChangeSelection,
    revisionDiffEntries,
    uniqueChangePaths,
} from "./changeReview";
import type { FileChange, StatusModel } from "./types";

const file = (overrides: Partial<FileChange>): FileChange => ({
    path: "src/app.ts",
    status: "modified",
    staged: false,
    worktree: true,
    ...overrides,
});

const status = (changes: readonly FileChange[]): StatusModel => ({
    ahead: 0,
    behind: 0,
    stashCount: 0,
    changes,
});

describe("상태변경", () => {
    it("[성공] 부분적으로 파일에 대해 별도의 용도 및 작업 트리 선택을 생성함", () => {
        expect(changeEntries(status([file({ staged: true })]))).toMatchObject([
            { selection: { path: "src/app.ts", layer: "index" } },
            { selection: { path: "src/app.ts", layer: "worktree" } },
        ]);
    });

    it("[성공] 소수 파일을 선택하기 때문에 반대 레이어를 반환함", () => {
        const entries = changeEntries(
            status([
                file({ staged: true, worktree: false }),
                file({ path: "src/next.ts" }),
            ]),
        );
        expect(
            reconcileChangeSelection(
                { path: "src/app.ts", layer: "worktree" },
                entries,
            ),
        ).toEqual({
            path: "src/app.ts",
            layer: "index",
        });
    });

    it("[실패] 캔디된 부분에서 안정성을 유지하고 모호한 패치 대상을 유지함", () => {
        expect(
            normalizePartialPatchTarget(
                { path: "src/app.ts", layer: "worktree" },
                { cached: true, reverse: false },
            ),
        ).toEqual({ cached: true, reverse: false });
        expect(
            normalizePartialPatchTarget(
                { path: "src/app.ts", layer: "index" },
                { cached: true, reverse: true },
            ),
        ).toEqual({ cached: true, reverse: true });
        expect(
            normalizePartialPatchTarget(
                { path: "src/app.ts", layer: "worktree" },
                { cached: false, reverse: true },
            ),
        ).toEqual({ cached: false, reverse: true });
        expect(
            normalizePartialPatchTarget(
                { path: "src/app.ts", layer: "index" },
                { cached: false, reverse: true },
            ),
        ).toBeNull();
    });

    it("[성공] 요청된 변경 사항 내에서 대안적인 해석을 제거함", () => {
        const partiallyStaged = changeEntries(status([file({ staged: true })]));
        expect(
            uniqueChangePaths(
                [...partiallyStaged, ...partiallyStaged],
                "index",
            ),
        ).toEqual(["src/app.ts"]);
        expect(uniqueChangePaths(partiallyStaged, "worktree")).toEqual([
            "src/app.ts",
        ]);
    });

    it("[성공] 처음에 첫 번째 항목을 선택하고 빈자리를 지킵니다", () => {
        const entries = changeEntries(status([file({})]));
        expect(reconcileChangeSelection(null, entries)).toEqual({
            path: "src/app.ts",
            layer: "worktree",
        });
        expect(
            reconcileChangeSelection(entries[0]?.selection ?? null, []),
        ).toBeNull();
    });

    it("[성공]한 보기, 선택, 기본 설정 및 초안 값의 플래그를 검사함", () => {
        expect(parseRepositoryViewMode("changes")).toBe("changes");
        expect(parseRepositoryViewMode("unknown")).toBe("history");
        expect(parseChangeSelection({ path: "a.ts", layer: "index" })).toEqual({
            path: "a.ts",
            layer: "index",
        });
        expect(parseChangeSelection({ path: "a.ts", layer: "bad" })).toBeNull();
        expect(parseDiffPreferences(null)).toEqual(DEFAULT_DIFF_PREFERENCES);
        expect(
            parseDiffPreferences({
                viewMode: "unified",
                whitespace: "ignoreAll",
                contextLines: "full",
                wordWrap: true,
                collapseUnchanged: false,
                synchronizedScroll: false,
            }),
        ).toEqual({
            viewMode: "unified",
            whitespace: "ignoreAll",
            contextLines: "full",
            wordWrap: true,
            collapseUnchanged: false,
            synchronizedScroll: false,
        });
        expect(
            parseCommitDraft({ message: "Draft", runHooks: false }),
        ).toMatchObject({
            message: "Draft",
            runHooks: false,
            changelistId: null,
        });
    });

    it("[성공] 볼트판 비교를 탐색 가능한 텍스트, 바이너리 및 하위 모듈 파일로 분할함", () => {
        const entries = revisionDiffEntries(
            [
                "diff --git a/src/app.ts b/src/app.ts",
                "index 1111111..2222222 100644",
                "--- a/src/app.ts",
                "+++ b/src/app.ts",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "diff --git a/assets/logo.png b/assets/logo.png",
                "new file mode 100644",
                "GIT binary patch",
                "diff --git a/vendor/library b/vendor/library",
                "index 3333333..4444444 160000",
                "--- a/vendor/library",
                "+++ b/vendor/library",
            ].join("\n"),
        );
        expect(entries.map((entry) => entry.file.path)).toEqual([
            "src/app.ts",
            "assets/logo.png",
            "vendor/library",
        ]);
        expect(entries[1]?.file).toMatchObject({
            status: "added",
            binary: true,
        });
        expect(entries[2]?.file.submodule).toBe(true);
    });
});
