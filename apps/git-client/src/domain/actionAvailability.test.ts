import { describe, expect, it } from "vitest";
import { deriveActionAvailability } from "./actionAvailability";
import type { Commit, SelectionContext } from "./types";

const commit = (
    oid: string,
    parents: readonly string[] = ["parent"],
): Commit => ({
    oid,
    parents,
    author: "Jamie",
    email: "jamie@example.com",
    authoredAt: 0,
    committedAt: 0,
    refs: [],
    subject: oid,
    body: "",
});

const context = (
    overrides: Partial<SelectionContext> = {},
): SelectionContext => ({
    selectedCommits: [commit("selected")],
    currentBranch: "main",
    headOid: "head",
    upstream: "origin/main",
    selectedIsAncestorOfHead: true,
    selectedIsAheadOfUpstream: true,
    selectedAreContiguousFirstParent: true,
    selectedIncludesMerge: false,
    hasChild: true,
    repositoryHasCommits: true,
    operationInProgress: false,
    ...overrides,
});

describe("가동 가동 가능", () => {
    it("[성공] 단일 상위 작업을 활성화함", () => {
        expect(deriveActionAvailability(context())).toMatchObject({
            copyRevision: true,
            cherryPick: true,
            drop: true,
            pushUpTo: true,
            goToParent: true,
            goToChild: true,
        });
    });

    it("[성공] 분리된 HEAD 및 활동 작업에 대한 분기 변경을 진행함", () => {
        for (const overrides of [
            { currentBranch: undefined },
            { operationInProgress: true },
        ]) {
            expect(deriveActionAvailability(context(overrides))).toMatchObject({
                reset: false,
                revert: false,
                drop: false,
                pushUpTo: false,
            });
        }
    });

    it("[성공]검사 및 스쿼시를 위해 두 번의 커밋이 필요함", () => {
        const availability = deriveActionAvailability(
            context({ selectedCommits: [commit("a"), commit("b")] }),
        );
        expect(availability).toMatchObject({
            compareVersions: true,
            squash: true,
            copyRevision: false,
            reset: false,
        });
    });

    it("[실패] 자물쇠 또는 연결되지 않은 첫 번째 상위 범위에서 빠른 스쿼시를 처리함", () => {
        expect(
            deriveActionAvailability(
                context({
                    selectedCommits: [commit("a"), commit("b")],
                    selectedAreContiguousFirstParent: false,
                }),
            ).squash,
        ).toBe(false);
        expect(
            deriveActionAvailability(
                context({
                    selectedCommits: [commit("a"), commit("b")],
                    selectedIncludesMerge: true,
                }),
            ).squash,
        ).toBe(false);
    });

    it("[실패] HEAD를 삭제하거나 하위 부분을 푸시하기 전에 상위 스트림 항목을 확인함", () => {
        expect(
            deriveActionAvailability(
                context({ selectedCommits: [commit("head")], headOid: "head" }),
            ),
        ).toMatchObject({ drop: false, cherryPick: false });
        expect(
            deriveActionAvailability(
                context({ selectedIsAncestorOfHead: false }),
            ),
        ).toMatchObject({
            drop: false,
            pushUpTo: false,
        });
        expect(
            deriveActionAvailability(
                context({ selectedIsAheadOfUpstream: false }),
            ),
        ).toMatchObject({
            pushUpTo: false,
        });
    });

    it("[성공] 전방 및 커밋을 처리함", () => {
        expect(
            deriveActionAvailability(
                context({ selectedCommits: [], repositoryHasCommits: false }),
            ),
        ).toEqual(expect.objectContaining({ newBranch: false, newTag: false }));
        expect(
            deriveActionAvailability(
                context({ selectedCommits: [commit("root", [])] }),
            ),
        ).toEqual(expect.objectContaining({ goToParent: false }));
    });
});
