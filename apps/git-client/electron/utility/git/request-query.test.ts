import { describe, expect, it } from "vitest";
import type {
    GitRequest,
    LogFilters,
    RepositoryId,
} from "../../../src/generated";
import {
    buildRequestArguments,
    type QueryOnlyGitRequest,
} from "./request-query";

const repositoryId = "00000000-0000-4000-8000-000000000001" as RepositoryId;
const filters: LogFilters = {
    query: null,
    branch: null,
    author: null,
    since: null,
    until: null,
    paths: [],
    noMerges: false,
};

describe("buildRequestArguments", () => {
    it.each<readonly [QueryOnlyGitRequest, string]>([
        [{ kind: "status", repositoryId }, "status"],
        [{ kind: "refs", repositoryId }, "for-each-ref"],
        [
            {
                kind: "log",
                repositoryId,
                skip: 0,
                limit: 1000,
                order: "topology",
                filters,
            },
            "log",
        ],
        [{ kind: "commitDetails", repositoryId, revision: "HEAD" }, "show"],
        [
            {
                kind: "diff",
                repositoryId,
                from: null,
                to: null,
                paths: [],
                staged: false,
                options: { whitespace: "show", contextLines: 3 },
            },
            "diff",
        ],
        [
            { kind: "tree", repositoryId, revision: "HEAD", path: null },
            "ls-tree",
        ],
        [
            {
                kind: "fileHistory",
                repositoryId,
                path: "file.txt",
                skip: 0,
                limit: 50,
            },
            "log",
        ],
        [
            { kind: "blame", repositoryId, revision: null, path: "file.txt" },
            "blame",
        ],
        [{ kind: "stashList", repositoryId }, "stash"],
        [
            {
                kind: "stashShow",
                repositoryId,
                stash: "stash@{0}",
                mode: "files",
            },
            "stash",
        ],
        [{ kind: "configList", repositoryId }, "config"],
        [{ kind: "submoduleStatus", repositoryId }, "submodule"],
        [{ kind: "signature", repositoryId, revision: "HEAD" }, "show"],
        [
            { kind: "checkIgnored", repositoryId, paths: ["ignored.txt"] },
            "ls-files",
        ],
        [
            { kind: "mergedBranches", repositoryId, target: "HEAD" },
            "for-each-ref",
        ],
        [
            {
                kind: "pushPreview",
                repositoryId,
                remote: "origin",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
            },
            "ls-remote",
        ],
        [
            {
                kind: "historyRewritePreview",
                repositoryId,
                fromRevision: "HEAD~2",
            },
            "log",
        ],
    ])("builds a fixed executable for $0.kind", (request, executable) => {
        expect(buildRequestArguments(request)[0]).toBe(executable);
    });

    it("preserves all supported log filters and clamps page size", () => {
        const args = buildRequestArguments({
            kind: "log",
            repositoryId,
            skip: 7,
            limit: 5_000,
            order: "date",
            filters: {
                query: "fix",
                branch: "main",
                author: "A Person",
                since: "2025-01-01",
                until: "2026-01-01",
                paths: ["src/file.ts"],
                noMerges: true,
            },
        });
        expect(args).toEqual(
            expect.arrayContaining([
                "--skip=7",
                "--max-count=500",
                "--date-order",
                "--no-merges",
                "--regexp-ignore-case",
                "--grep=fix",
                "--author=A Person",
                "--since=2025-01-01",
                "--until=2026-01-01",
                "main",
                "--",
                "src/file.ts",
            ]),
        );
    });

    it("rejects path traversal, option-like revisions, invalid refs, NUL text, and invalid pages", () => {
        const invalidRequests: GitRequest[] = [
            { kind: "tree", repositoryId, revision: "HEAD", path: "../secret" },
            { kind: "signature", repositoryId, revision: "--all" },
            {
                kind: "pushPreview",
                repositoryId,
                remote: "origin/evil",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
            },
            {
                kind: "log",
                repositoryId,
                skip: 0,
                limit: 100,
                order: "topology",
                filters: { ...filters, query: "bad\0query" },
            },
            {
                kind: "fileHistory",
                repositoryId,
                path: "file",
                skip: -1,
                limit: 1,
            },
        ];
        for (const request of invalidRequests) {
            expect(() =>
                buildRequestArguments(request as QueryOnlyGitRequest),
            ).toThrow();
        }
    });
});
