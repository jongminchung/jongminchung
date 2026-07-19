import { describe, expect, it } from "vitest";
import type { GitRequest, RepositoryId } from "../../generated";
import {
    GitDomainRequestSchema,
    GitDomainQueryRequestSchema,
    GitExecutionRequestSchema,
    GitQueryRequestSchema,
    type GitDomainRequest,
    type GitDomainQueryRequest,
} from "./git-request";
import { MainToGitUtilityMessageSchema } from "./git-utility-process";
import { VALID_GIT_OPERATIONS } from "./git-operation-fixtures";

const repositoryId = "00000000-0000-4000-8000-000000000001" as RepositoryId;
const requestId = "00000000-0000-4000-8000-000000000002";
const correlationId = "00000000-0000-4000-8000-000000000003";

type QueryOnlyGeneratedGitRequest = Exclude<GitRequest, { kind: "operation" }>;
type Assert<T extends true> = T;
type DomainAcceptsEveryGeneratedQuery = Assert<
    QueryOnlyGeneratedGitRequest extends GitDomainQueryRequest ? true : false
>;
type GeneratedAcceptsEveryDomainQuery = Assert<
    GitDomainQueryRequest extends QueryOnlyGeneratedGitRequest ? true : false
>;
type DomainAcceptsEveryGeneratedRequest = Assert<
    GitRequest extends GitDomainRequest ? true : false
>;
type GeneratedAcceptsEveryDomainRequest = Assert<
    GitDomainRequest extends GitRequest ? true : false
>;
const compileTimeCompatibility: readonly [
    DomainAcceptsEveryGeneratedQuery,
    GeneratedAcceptsEveryDomainQuery,
    DomainAcceptsEveryGeneratedRequest,
    GeneratedAcceptsEveryDomainRequest,
] = [true, true, true, true];

describe("GitDomainQueryRequestSchema", () => {
    it.each([
        { kind: "status", repositoryId },
        { kind: "refs", repositoryId },
        {
            kind: "log",
            repositoryId,
            skip: 0,
            limit: 100,
            order: "topology",
            filters: {
                query: null,
                branch: null,
                author: null,
                since: null,
                until: null,
                paths: [],
                noMerges: false,
            },
        },
        { kind: "commitDetails", repositoryId, revision: "HEAD" },
        {
            kind: "diff",
            repositoryId,
            from: null,
            to: null,
            paths: [],
            staged: false,
            options: { whitespace: "show", contextLines: 3 },
        },
        { kind: "tree", repositoryId, revision: "HEAD", path: null },
        { kind: "fileHistory", repositoryId, path: "a", skip: 0, limit: 50 },
        { kind: "blame", repositoryId, revision: null, path: "a" },
        { kind: "stashList", repositoryId },
        { kind: "stashShow", repositoryId, stash: "stash@{0}", mode: "files" },
        { kind: "configList", repositoryId },
        { kind: "submoduleStatus", repositoryId },
        { kind: "signature", repositoryId, revision: "HEAD" },
        { kind: "checkIgnored", repositoryId, paths: ["ignored"] },
        { kind: "mergedBranches", repositoryId, target: "HEAD" },
        {
            kind: "pushPreview",
            repositoryId,
            remote: "origin",
            remoteRef: "refs/heads/main",
            localRevision: "HEAD",
        },
        { kind: "historyRewritePreview", repositoryId, fromRevision: "HEAD~2" },
    ])("accepts $kind", (request) => {
        expect(GitDomainQueryRequestSchema.parse(request)).toEqual(request);
        const transportRequest = { ...request, requestId };
        expect(GitQueryRequestSchema.parse(transportRequest)).toEqual(
            transportRequest,
        );
        expect(
            MainToGitUtilityMessageSchema.parse({
                kind: "query",
                correlationId,
                request: transportRequest,
            }),
        ).toEqual({ kind: "query", correlationId, request: transportRequest });
    });

    it("keeps generated and domain request variants compatible in both directions", () => {
        expect(compileTimeCompatibility).toEqual([true, true, true, true]);
        expect(
            GitDomainQueryRequestSchema.safeParse({
                kind: "operation",
                repositoryId,
                operation: { kind: "fetch", remote: "origin", prune: false },
            }).success,
        ).toBe(false);
        expect(
            GitQueryRequestSchema.parse({
                kind: "commitDetails",
                requestId,
                repositoryId,
                revision: "HEAD",
            }),
        ).toEqual({
            kind: "commitDetails",
            requestId,
            repositoryId,
            revision: "HEAD",
        });
    });

    it.each(VALID_GIT_OPERATIONS)(
        "strictly validates and transports the $kind operation request",
        (operation) => {
            const domainRequest = {
                kind: "operation",
                repositoryId,
                operation,
            } as const;
            const transportRequest = { ...domainRequest, requestId };

            expect(GitDomainRequestSchema.parse(domainRequest)).toEqual(
                domainRequest,
            );
            expect(GitExecutionRequestSchema.parse(transportRequest)).toEqual(
                transportRequest,
            );
            expect(
                MainToGitUtilityMessageSchema.parse({
                    kind: "query",
                    correlationId,
                    request: transportRequest,
                }),
            ).toEqual({
                kind: "query",
                correlationId,
                request: transportRequest,
            });
        },
    );

    it("strictly rejects transport-only and unknown fields at the correct boundary", () => {
        expect(
            GitDomainQueryRequestSchema.safeParse({
                kind: "status",
                requestId,
                repositoryId,
            }).success,
        ).toBe(false);
        expect(
            GitQueryRequestSchema.safeParse({
                kind: "status",
                requestId,
                repositoryId,
                arbitraryCommand: "git clean -fdx",
            }).success,
        ).toBe(false);
    });

    it("rejects structural abuse before command construction", () => {
        const invalid = [
            { kind: "unknown", repositoryId },
            {
                kind: "log",
                repositoryId,
                skip: -1,
                limit: 1,
                order: "topology",
                filters: {},
            },
            {
                kind: "diff",
                repositoryId,
                from: null,
                to: null,
                paths: [],
                staged: false,
                options: { whitespace: "show", contextLines: 4 },
            },
            { kind: "tree", repositoryId, revision: "HEAD", path: "../secret" },
            { kind: "signature", repositoryId, revision: "--all" },
            {
                kind: "checkIgnored",
                repositoryId,
                paths: Array.from({ length: 10_001 }, () => "a"),
            },
        ];
        for (const request of invalid) {
            expect(GitDomainQueryRequestSchema.safeParse(request).success).toBe(
                false,
            );
        }
    });
});
