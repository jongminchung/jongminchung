import { z } from "zod";
import { GitRequestIdSchema, RepositoryIdSchema } from "./git-identifiers";
import { GitOperationSchema } from "./git-operation";

function isSafeRevision(value: string): boolean {
    if (value.startsWith("-")) return false;
    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (codePoint <= 0x20 || codePoint === 0x7f) return false;
    }
    return true;
}

const RevisionSchema = z
    .string()
    .min(1)
    .max(512)
    .refine(
        isSafeRevision,
        "Revision must be a non-option value without unsafe characters",
    );
const RelativePathSchema = z
    .string()
    .min(1)
    .max(16_384)
    .refine(
        (value) =>
            !value.includes("\0") &&
            !value.startsWith("/") &&
            !value.startsWith("\\") &&
            !/^[A-Za-z]:[\\/]/u.test(value) &&
            !value.split(/[\\/]/u).includes(".."),
        "Path must stay inside the repository",
    );
const FilterTextSchema = z.string().max(16_384).nullable();
const SearchTextSchema = z
    .string()
    .min(1)
    .max(1_024)
    .refine(
        (value) => !value.includes("\0"),
        "Search text must not contain null bytes",
    );

export const GitTextSearchOptionsSchema = z
    .object({
        matchCase: z.boolean(),
        words: z.boolean(),
        regex: z.boolean(),
    })
    .strict();

function isSupportedContextLines(value: number): boolean {
    return value === 3 || value === 5 || value === 10;
}

export const GitLogFiltersSchema = z
    .object({
        query: FilterTextSchema,
        branch: RevisionSchema.nullable(),
        author: FilterTextSchema,
        since: FilterTextSchema,
        until: FilterTextSchema,
        paths: z.array(RelativePathSchema).max(10_000),
        noMerges: z.boolean(),
    })
    .strict();

export const GitDiffOptionsSchema = z
    .object({
        whitespace: z.enum(["show", "ignoreAll"]),
        contextLines: z
            .number()
            .int()
            .refine(isSupportedContextLines, {
                message: "Diff context lines must be 3, 5, 10, or null",
            })
            .nullable(),
    })
    .strict();

function queryVariants<Identity extends z.ZodRawShape>(identity: Identity) {
    const query = <Shape extends z.ZodRawShape>(shape: Shape) =>
        z
            .object({ ...identity, ...shape })
            .strict()
            .readonly();

    return [
        query({ kind: z.literal("status") }),
        query({ kind: z.literal("refs") }),
        query({ kind: z.literal("files") }),
        query({
            kind: z.literal("searchText"),
            query: SearchTextSchema,
            options: GitTextSearchOptionsSchema,
        }),
        query({
            kind: z.literal("log"),
            skip: z.number().int().min(0).max(10_000_000),
            limit: z.number().int().min(1).max(5_000),
            order: z.enum(["date", "topology", "firstParent"]),
            filters: GitLogFiltersSchema,
        }),
        query({ kind: z.literal("commitDetails"), revision: RevisionSchema }),
        query({
            kind: z.literal("diff"),
            from: RevisionSchema.nullable(),
            to: RevisionSchema.nullable(),
            paths: z.array(RelativePathSchema).max(10_000),
            staged: z.boolean(),
            options: GitDiffOptionsSchema,
        }),
        query({
            kind: z.literal("tree"),
            revision: RevisionSchema,
            path: RelativePathSchema.nullable(),
        }),
        query({
            kind: z.literal("fileHistory"),
            path: RelativePathSchema,
            skip: z.number().int().min(0).max(10_000_000),
            limit: z.number().int().min(1).max(5_000),
        }),
        query({
            kind: z.literal("blame"),
            revision: RevisionSchema.nullable(),
            path: RelativePathSchema,
        }),
        query({ kind: z.literal("stashList") }),
        query({
            kind: z.literal("stashShow"),
            stash: RevisionSchema,
            mode: z.enum(["files", "patch"]),
        }),
        query({ kind: z.literal("configList") }),
        query({ kind: z.literal("submoduleStatus") }),
        query({ kind: z.literal("signature"), revision: RevisionSchema }),
        query({
            kind: z.literal("checkIgnored"),
            paths: z.array(RelativePathSchema).max(10_000),
        }),
        query({ kind: z.literal("mergedBranches"), target: RevisionSchema }),
        query({
            kind: z.literal("pushPreview"),
            remote: z.string().min(1).max(512),
            remoteRef: z.string().min(1).max(512),
            localRevision: RevisionSchema,
        }),
        query({
            kind: z.literal("historyRewritePreview"),
            fromRevision: RevisionSchema,
        }),
    ] as const;
}

const domainIdentity = { repositoryId: RepositoryIdSchema } as const;
const transportIdentity = {
    requestId: GitRequestIdSchema,
    repositoryId: RepositoryIdSchema,
} as const;

export const GitDomainQueryRequestSchema = z
    .discriminatedUnion("kind", queryVariants(domainIdentity))
    .readonly();

export const GitQueryRequestSchema = z
    .discriminatedUnion("kind", queryVariants(transportIdentity))
    .readonly();

const operationVariant = <Identity extends z.ZodRawShape>(identity: Identity) =>
    z
        .object({
            ...identity,
            kind: z.literal("operation"),
            operation: GitOperationSchema,
        })
        .strict()
        .readonly();

export const GitDomainRequestSchema = z
    .discriminatedUnion("kind", [
        ...queryVariants(domainIdentity),
        operationVariant(domainIdentity),
    ])
    .readonly();

export const GitExecutionRequestSchema = z
    .discriminatedUnion("kind", [
        ...queryVariants(transportIdentity),
        operationVariant(transportIdentity),
    ])
    .readonly();

export type GitDomainQueryRequest = z.infer<typeof GitDomainQueryRequestSchema>;
export type GitQueryRequest = z.infer<typeof GitQueryRequestSchema>;
export type GitDomainRequest = z.infer<typeof GitDomainRequestSchema>;
export type GitExecutionRequest = z.infer<typeof GitExecutionRequestSchema>;
