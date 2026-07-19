import { describe, expect, it } from "vitest";
import {
    GitRepositoryServiceRequestSchema,
    GitRepositoryServiceResultSchema,
} from "./git-utility";

const repositoryId = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const oid = "0123456789abcdef0123456789abcdef01234567";
const shelfId = "896b19c6-dd8f-4f7b-a591-cf701e86457c";
const changelistId = "723094e7-bf3b-4d3e-8f74-6cebe9571840";
const recoveryId = "53f66fe0-6b52-4a69-9b9f-b07c724f9095";
const secondRepositoryId = "50dce2ce-cd90-4f4a-8af7-dbb005bf7262";

describe("Git repository service contracts", () => {
    it("accepts correlated bounded inspection and ignore-rule values", () => {
        expect(
            GitRepositoryServiceRequestSchema.parse({
                operation: "compareBranches",
                repositoryId,
                left: "feature",
                right: "main",
            }),
        ).toMatchObject({
            operation: "compareBranches",
            left: "feature",
            right: "main",
        });
        expect(
            GitRepositoryServiceResultSchema.parse({
                operation: "compareBranches",
                value: { ahead: 1, behind: 0, leftOnly: [oid], rightOnly: [] },
            }),
        ).toMatchObject({
            operation: "compareBranches",
            value: { leftOnly: [oid] },
        });
        expect(
            GitRepositoryServiceRequestSchema.parse({
                operation: "writeIgnoreRules",
                repositoryId,
                rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
            }),
        ).toMatchObject({ operation: "writeIgnoreRules" });
    });

    it("rejects unknown fields, unsafe revisions, null bytes, and invalid result objects", () => {
        const invalidRequests: readonly unknown[] = [
            { operation: "listRemotes", repositoryId, unexpected: true },
            {
                operation: "compareBranches",
                repositoryId,
                left: "--all",
                right: "main",
            },
            {
                operation: "listMergedBranches",
                repositoryId,
                target: "HEAD\nmain",
            },
            {
                operation: "writeIgnoreRules",
                repositoryId,
                rules: { gitignore: "dist/\0secret", infoExclude: "" },
            },
        ];
        for (const request of invalidRequests) {
            expect(
                GitRepositoryServiceRequestSchema.safeParse(request).success,
            ).toBe(false);
        }
        expect(
            GitRepositoryServiceResultSchema.safeParse({
                operation: "compareBranches",
                value: {
                    ahead: -1,
                    behind: 0,
                    leftOnly: ["not-an-oid"],
                    rightOnly: [],
                },
            }).success,
        ).toBe(false);
        expect(
            GitRepositoryServiceResultSchema.safeParse({
                operation: "writeIgnoreRules",
                value: true,
            }).success,
        ).toBe(false);
    });

    it("defines all 17 bounded special service request and result variants", () => {
        const requests: readonly unknown[] = [
            {
                operation: "exportPatch",
                repositoryId,
                revisions: ["HEAD"],
                targetPath: "/tmp/export.patch",
            },
            { operation: "createPatchText", repositoryId, revisions: ["HEAD"] },
            {
                operation: "importPatch",
                repositoryId,
                path: "/tmp/import.patch",
            },
            {
                operation: "createShelf",
                repositoryId,
                message: "saved",
                paths: ["tracked.txt"],
            },
            { operation: "listShelves", repositoryId },
            {
                operation: "applyShelf",
                repositoryId,
                shelfId,
                dropAfterApply: true,
            },
            { operation: "deleteShelf", repositoryId, shelfId },
            { operation: "listChangelists", repositoryId },
            {
                operation: "saveChangelist",
                repositoryId,
                id: null,
                name: "selected",
                paths: ["tracked.txt"],
            },
            { operation: "deleteChangelist", repositoryId, changelistId },
            {
                operation: "commitChangelist",
                repositoryId,
                changelistId,
                message: "commit",
                amend: false,
                signOff: false,
                gpgSign: false,
            },
            { operation: "listRecoveryEntries", repositoryId },
            {
                operation: "restoreRecoveryEntry",
                repositoryId,
                entryId: recoveryId,
            },
            { operation: "listConflicts", repositoryId },
            { operation: "readConflict", repositoryId, path: "tracked.txt" },
            {
                operation: "writeConflictResult",
                repositoryId,
                path: "tracked.txt",
                result: "resolved\n",
                stage: true,
            },
            {
                operation: "resolveBinaryConflict",
                repositoryId,
                path: "tracked.bin",
                side: "ours",
            },
        ];
        const checksum = "a".repeat(64);
        const shelf = {
            id: shelfId,
            repositoryId,
            message: "saved",
            createdAtMs: 1,
            files: [{ path: "tracked.txt", checksum: "", untracked: false }],
            indexPatchChecksum: checksum,
            worktreePatchChecksum: checksum,
        };
        const changelist = {
            id: changelistId,
            repositoryId,
            name: "selected",
            paths: ["tracked.txt"],
            createdAtMs: 1,
            updatedAtMs: 1,
        };
        const recovery = {
            id: recoveryId,
            repositoryId,
            operation: "commit",
            createdAtMs: 1,
            branch: "main",
            headOid: oid,
            refs: [{ name: "refs/heads/main", oid }],
            recoverable: true,
        };
        const conflict = {
            path: "tracked.txt",
            baseOid: oid,
            localOid: oid,
            remoteOid: oid,
            binary: false,
        };
        const results: readonly unknown[] = [
            {
                operation: "exportPatch",
                value: {
                    path: "/tmp/export.patch",
                    sizeBytes: 1,
                    commitCount: 1,
                },
            },
            { operation: "createPatchText", value: "patch" },
            { operation: "importPatch" },
            { operation: "createShelf", value: shelf },
            { operation: "listShelves", value: [shelf] },
            { operation: "applyShelf" },
            { operation: "deleteShelf" },
            { operation: "listChangelists", value: [changelist] },
            { operation: "saveChangelist", value: changelist },
            { operation: "deleteChangelist" },
            {
                operation: "commitChangelist",
                value: { changelistId, commitOid: oid },
            },
            { operation: "listRecoveryEntries", value: [recovery] },
            {
                operation: "restoreRecoveryEntry",
                value: {
                    entryId: recoveryId,
                    restoredRefs: ["refs/heads/main"],
                },
            },
            { operation: "listConflicts", value: [conflict] },
            {
                operation: "readConflict",
                value: {
                    path: "tracked.txt",
                    base: "base\n",
                    local: "local\n",
                    remote: "remote\n",
                    result: "result\n",
                    binary: false,
                    localLabel: "HEAD",
                    remoteLabel: "feature",
                },
            },
            { operation: "writeConflictResult" },
            { operation: "resolveBinaryConflict" },
        ];

        expect(requests).toHaveLength(17);
        expect(results).toHaveLength(17);
        for (const request of requests) {
            expect(
                GitRepositoryServiceRequestSchema.safeParse(request).success,
            ).toBe(true);
        }
        for (const result of results) {
            expect(
                GitRepositoryServiceResultSchema.safeParse(result).success,
            ).toBe(true);
        }
    });

    it("rejects traversal, option injection, oversized text, and malformed special DTOs", () => {
        const invalidRequests: readonly unknown[] = [
            {
                operation: "exportPatch",
                repositoryId,
                revisions: ["HEAD"],
                targetPath: "relative.patch",
            },
            {
                operation: "createPatchText",
                repositoryId,
                revisions: ["--all"],
            },
            {
                operation: "createShelf",
                repositoryId,
                message: "saved",
                paths: ["../secret"],
            },
            {
                operation: "createShelf",
                repositoryId,
                message: "bad\0message",
                paths: ["tracked.txt"],
            },
            {
                operation: "applyShelf",
                repositoryId,
                shelfId: "not-a-uuid",
                dropAfterApply: false,
            },
            {
                operation: "writeConflictResult",
                repositoryId,
                path: "tracked.txt",
                result: "x".repeat(5 * 1024 * 1024 + 1),
                stage: false,
            },
            {
                operation: "resolveBinaryConflict",
                repositoryId,
                path: "tracked.bin",
                side: "base",
            },
        ];
        for (const request of invalidRequests) {
            expect(
                GitRepositoryServiceRequestSchema.safeParse(request).success,
            ).toBe(false);
        }
        expect(
            GitRepositoryServiceResultSchema.safeParse({
                operation: "createShelf",
                value: {
                    id: shelfId,
                    repositoryId,
                    message: "saved",
                    createdAtMs: 1,
                    files: [],
                    indexPatchChecksum: "secret-token",
                    worktreePatchChecksum: "a".repeat(64),
                },
            }).success,
        ).toBe(false);
    });

    it("strictly correlates submodule, file-open, and multi-root service values", () => {
        const requests: readonly unknown[] = [
            {
                operation: "loadSubmoduleDiff",
                repositoryId,
                before: { kind: "revision", revision: "HEAD~1" },
                after: { kind: "workingTree" },
                path: "modules/client",
            },
            {
                operation: "resolveWorkingTreeFile",
                repositoryId,
                path: "tracked.txt",
            },
            {
                operation: "executeSynchronizedBranchOperation",
                repositoryIds: [repositoryId, secondRepositoryId],
                gitOperation: {
                    kind: "createBranch",
                    name: "feature",
                    startPoint: "HEAD",
                    checkout: true,
                },
            },
            {
                operation: "applyMultiRootRollback",
                steps: [
                    {
                        repositoryId,
                        path: "/tmp/repository",
                        description: "check out main",
                        operations: [
                            { kind: "checkout", target: "main", force: false },
                        ],
                    },
                ],
            },
        ];
        const results: readonly unknown[] = [
            {
                operation: "loadSubmoduleDiff",
                value: {
                    path: "modules/client",
                    beforeOid: oid,
                    afterOid: oid,
                    beforeSubject: "before",
                    afterSubject: "after",
                    ahead: 0,
                    behind: 0,
                },
            },
            {
                operation: "resolveWorkingTreeFile",
                value: "/tmp/repository/tracked.txt",
            },
            {
                operation: "executeSynchronizedBranchOperation",
                value: {
                    outcomes: [
                        {
                            repositoryId,
                            path: "/tmp/repository",
                            succeeded: true,
                            message: "completed",
                        },
                    ],
                    rollbackPlan: [],
                },
            },
            {
                operation: "applyMultiRootRollback",
                value: [
                    {
                        repositoryId,
                        path: "/tmp/repository",
                        succeeded: true,
                        message: "rollback completed",
                    },
                ],
            },
        ];

        for (const request of requests) {
            expect(
                GitRepositoryServiceRequestSchema.safeParse(request).success,
            ).toBe(true);
        }
        for (const result of results) {
            expect(
                GitRepositoryServiceResultSchema.safeParse(result).success,
            ).toBe(true);
        }

        const invalidRequests: readonly unknown[] = [
            {
                operation: "loadSubmoduleDiff",
                repositoryId,
                before: { kind: "revision", revision: "--all" },
                after: { kind: "index" },
                path: "modules/client",
            },
            {
                operation: "resolveWorkingTreeFile",
                repositoryId,
                path: "../secret",
            },
            {
                operation: "executeSynchronizedBranchOperation",
                repositoryIds: [repositoryId, repositoryId],
                gitOperation: {
                    kind: "checkout",
                    target: "main",
                    force: false,
                },
            },
            {
                operation: "executeSynchronizedBranchOperation",
                repositoryIds: [repositoryId],
                gitOperation: { kind: "checkout", target: "main", force: true },
            },
            {
                operation: "executeSynchronizedBranchOperation",
                repositoryIds: [repositoryId],
                gitOperation: {
                    kind: "merge",
                    revision: "main",
                    noFf: false,
                    squash: false,
                },
            },
            {
                operation: "applyMultiRootRollback",
                steps: [
                    {
                        repositoryId,
                        path: "/tmp/repository",
                        description: "unsafe",
                        operations: [
                            {
                                kind: "deleteBranch",
                                name: "feature",
                                force: true,
                            },
                        ],
                    },
                ],
            },
        ];
        for (const request of invalidRequests) {
            expect(
                GitRepositoryServiceRequestSchema.safeParse(request).success,
            ).toBe(false);
        }
    });
});
