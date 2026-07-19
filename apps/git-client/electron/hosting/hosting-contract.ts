import { z } from "zod";

const MAX_URL_CHARACTERS = 2_048;
const MAX_IDENTIFIER_CHARACTERS = 256;
const MAX_PROJECT_CHARACTERS = 1_024;
const MAX_BRANCH_CHARACTERS = 1_024;
const MAX_TITLE_CHARACTERS = 16_384;
const MAX_BODY_CHARACTERS = 1_048_576;

function normalizedOrigin(value: string): string | null {
    try {
        const url = new URL(value);
        if (
            url.protocol !== "https:" ||
            url.hostname.length === 0 ||
            url.username.length > 0 ||
            url.password.length > 0 ||
            url.search.length > 0 ||
            url.hash.length > 0
        ) {
            return null;
        }
        return url.origin;
    } catch {
        return null;
    }
}

function safeProject(value: string): boolean {
    const segments = value.split("/");
    return (
        segments.length >= 2 &&
        segments.every(
            (segment) =>
                segment.length > 0 &&
                segment !== "." &&
                segment !== ".." &&
                !segment.startsWith("-") &&
                !/[\s\p{Cc}]/u.test(segment),
        )
    );
}

function safeBranch(value: string): boolean {
    return (
        value.trim().length > 0 &&
        !value.startsWith("-") &&
        !value.includes("\0") &&
        !value.includes(" ")
    );
}

function requiredText(value: string): boolean {
    return value.trim().length > 0 && !value.includes("\0");
}

const HostingBaseUrlInputSchema = z
    .string()
    .trim()
    .min(1)
    .max(MAX_URL_CHARACTERS);

export const HostingBaseUrlSchema = HostingBaseUrlInputSchema.transform(
    (value, context) => {
        const origin = normalizedOrigin(value);
        if (origin === null) {
            context.addIssue({
                code: "custom",
                message:
                    "base URL must be an HTTPS origin without credentials, query, or fragment",
            });
            return z.NEVER;
        }
        return origin;
    },
);

export function normalizeHostingBaseUrl(value: unknown): string {
    return HostingBaseUrlSchema.parse(value);
}

export const HostingProviderKindSchema = z.enum(["gitHub", "gitLab"]);
export type HostingProviderKind = z.infer<typeof HostingProviderKindSchema>;

export const HostingAccountIdSchema = z
    .string()
    .min(1)
    .max(MAX_IDENTIFIER_CHARACTERS);

export const HostingAccountSchema = z
    .object({
        id: HostingAccountIdSchema,
        provider: HostingProviderKindSchema,
        baseUrl: HostingBaseUrlSchema,
        login: z
            .string()
            .max(MAX_IDENTIFIER_CHARACTERS)
            .refine(
                (value) => value.trim().length > 0,
                "login must not be empty",
            ),
    })
    .strict()
    .readonly();
export type HostingAccount = Readonly<z.infer<typeof HostingAccountSchema>>;

export const HostingAccountsSchema = z
    .array(HostingAccountSchema)
    .max(1_000)
    .readonly();

export const SaveHostingAccountSchema = z
    .object({
        provider: HostingProviderKindSchema,
        baseUrl: HostingBaseUrlSchema,
        token: z
            .string()
            .max(16_384)
            .refine(
                (value) => value.trim().length > 0,
                "token must not be empty",
            ),
    })
    .strict()
    .readonly();

const ProjectSchema = z
    .string()
    .min(1)
    .max(MAX_PROJECT_CHARACTERS)
    .refine(
        safeProject,
        "project must be a safe owner/repository or group/repository value",
    );
const NumberSchema = z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER);
const PageSchema = z.number().int().min(0).max(4_294_967_295);
const BranchSchema = z
    .string()
    .max(MAX_BRANCH_CHARACTERS)
    .refine(safeBranch, "branch is invalid");
const FilePathSchema = z
    .string()
    .min(1)
    .max(16_384)
    .refine(
        (value) =>
            !value.startsWith("/") &&
            !value.includes("\0") &&
            !value.split("/").some((segment) => segment === ".."),
        "file path is invalid",
    );
const BodySchema = z.string().max(MAX_BODY_CHARACTERS);
const RequiredBodySchema = BodySchema.refine(
    requiredText,
    "body must not be empty",
);
const TitleSchema = z
    .string()
    .max(MAX_TITLE_CHARACTERS)
    .refine(requiredText, "title must not be empty");

export const HostingReviewEventSchema = z.enum([
    "approve",
    "requestChanges",
    "comment",
]);
export type HostingReviewEvent = z.infer<typeof HostingReviewEventSchema>;

const HostingListRequestSchema = z
    .object({
        kind: z.literal("list"),
        project: ProjectSchema,
        page: PageSchema,
    })
    .strict()
    .readonly();
const HostingGetRequestSchema = z
    .object({
        kind: z.literal("get"),
        project: ProjectSchema,
        number: NumberSchema,
    })
    .strict()
    .readonly();
const HostingFilesRequestSchema = z
    .object({
        kind: z.literal("files"),
        project: ProjectSchema,
        number: NumberSchema,
    })
    .strict()
    .readonly();
const HostingTimelineRequestSchema = z
    .object({
        kind: z.literal("timeline"),
        project: ProjectSchema,
        number: NumberSchema,
    })
    .strict()
    .readonly();
const HostingViewedFilesRequestSchema = z
    .object({
        kind: z.literal("viewedFiles"),
        project: ProjectSchema,
        number: NumberSchema,
    })
    .strict()
    .readonly();
const HostingSetViewedRequestSchema = z
    .object({
        kind: z.literal("setViewed"),
        pullRequestId: z.string().min(1).max(MAX_IDENTIFIER_CHARACTERS),
        path: FilePathSchema,
        viewed: z.boolean(),
    })
    .strict()
    .readonly();
const HostingCreateRequestSchema = z
    .object({
        kind: z.literal("create"),
        project: ProjectSchema,
        title: TitleSchema,
        body: BodySchema,
        sourceBranch: BranchSchema,
        targetBranch: BranchSchema,
        draft: z.boolean(),
    })
    .strict()
    .readonly();
const HostingCommentRequestSchema = z
    .object({
        kind: z.literal("comment"),
        project: ProjectSchema,
        number: NumberSchema,
        body: RequiredBodySchema,
    })
    .strict()
    .readonly();
const HostingReviewRequestSchema = z
    .object({
        kind: z.literal("review"),
        project: ProjectSchema,
        number: NumberSchema,
        event: HostingReviewEventSchema,
        body: BodySchema,
    })
    .strict()
    .readonly();
const HostingUpdateBranchRequestSchema = z
    .object({
        kind: z.literal("updateBranch"),
        project: ProjectSchema,
        number: NumberSchema,
    })
    .strict()
    .readonly();
const HostingSyncForkRequestSchema = z
    .object({
        kind: z.literal("syncFork"),
        project: ProjectSchema,
        branch: BranchSchema,
    })
    .strict()
    .readonly();
const HostingListNamespacesRequestSchema = z
    .object({ kind: z.literal("listNamespaces") })
    .strict()
    .readonly();
const RepositoryNameSchema = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/u, "repository name is invalid");
const NamespacePathSchema = z
    .string()
    .min(1)
    .max(MAX_PROJECT_CHARACTERS)
    .refine(
        (value) =>
            value.split("/").every(
                (segment) =>
                    segment.length > 0 &&
                    segment !== "." &&
                    segment !== ".." &&
                    !segment.startsWith("-") &&
                    !/[\s\p{Cc}]/u.test(segment),
            ),
        "namespace path is invalid",
    );
const HostingListShareRepositoriesRequestSchema = z
    .object({ kind: z.literal("listShareRepositories") })
    .strict()
    .readonly();
const HostingCheckShareRepositoryRequestSchema = z
    .object({
        kind: z.literal("checkShareRepository"),
        namespacePath: NamespacePathSchema,
        name: RepositoryNameSchema,
    })
    .strict()
    .readonly();
const HostedRepositoryUrlSchema = z
    .url()
    .max(MAX_URL_CHARACTERS)
    .refine((value) => {
        const url = new URL(value);
        return (
            (url.protocol === "https:" || url.protocol === "http:") &&
            url.username === "" &&
            url.password === ""
        );
    }, "repository URL must be credential-free HTTP or HTTPS");
const HostingShareRepositoryRequestSchema = z
    .object({
        kind: z.literal("shareRepository"),
        name: RepositoryNameSchema,
        description: BodySchema,
        private: z.boolean(),
        namespaceId: z
            .string()
            .min(1)
            .max(MAX_IDENTIFIER_CHARACTERS)
            .regex(
                /^(?:gid:\/\/gitlab\/[A-Za-z:]+\/)?[0-9]+$/u,
                "namespace ID is invalid",
            )
            .nullable(),
    })
    .strict()
    .readonly();

export const HostingRequestSchema = z
    .discriminatedUnion("kind", [
        HostingListRequestSchema,
        HostingGetRequestSchema,
        HostingFilesRequestSchema,
        HostingTimelineRequestSchema,
        HostingViewedFilesRequestSchema,
        HostingSetViewedRequestSchema,
        HostingCreateRequestSchema,
        HostingCommentRequestSchema,
        HostingReviewRequestSchema,
        HostingUpdateBranchRequestSchema,
        HostingSyncForkRequestSchema,
        HostingListNamespacesRequestSchema,
        HostingListShareRepositoriesRequestSchema,
        HostingCheckShareRepositoryRequestSchema,
        HostingShareRepositoryRequestSchema,
    ])
    .readonly();
export type HostingRequest = Readonly<z.infer<typeof HostingRequestSchema>>;

export const HostingChangeRequestSchema = z
    .object({
        number: NumberSchema,
        title: z.string(),
        state: z.string(),
        author: z.string(),
        sourceBranch: z.string(),
        targetBranch: z.string(),
        webUrl: z.string(),
        nodeId: z.string().nullable(),
        draft: z.boolean(),
        updatedAt: z.string(),
    })
    .strict()
    .readonly();
export type HostingChangeRequest = Readonly<
    z.infer<typeof HostingChangeRequestSchema>
>;

export const HostingChangedFileSchema = z
    .object({
        path: z.string(),
        previousPath: z.string().nullable(),
        status: z.string(),
        additions: NumberSchema,
        deletions: NumberSchema,
        patch: z.string().nullable(),
    })
    .strict()
    .readonly();
export type HostingChangedFile = Readonly<
    z.infer<typeof HostingChangedFileSchema>
>;

export const HostingTimelineEntrySchema = z
    .object({
        id: z.string(),
        kind: z.string(),
        author: z.string(),
        body: z.string(),
        createdAt: z.string(),
    })
    .strict()
    .readonly();
export type HostingTimelineEntry = Readonly<
    z.infer<typeof HostingTimelineEntrySchema>
>;

export const HostingResponseSchema = z
    .discriminatedUnion("kind", [
        z
            .object({
                kind: z.literal("changeRequests"),
                items: z.array(HostingChangeRequestSchema),
                nextPage: PageSchema.nullable(),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("changeRequest"),
                item: HostingChangeRequestSchema,
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("files"),
                items: z.array(HostingChangedFileSchema),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("timeline"),
                items: z.array(HostingTimelineEntrySchema),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("viewedFiles"),
                paths: z.array(FilePathSchema),
            })
            .strict()
            .readonly(),
        z
            .object({ kind: z.literal("completed"), message: z.string() })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("namespaces"),
                items: z
                    .array(
                        z
                            .object({
                                id: z
                                    .string()
                                    .min(1)
                                    .max(MAX_IDENTIFIER_CHARACTERS)
                                    .nullable(),
                                fullName: z.string().min(1).max(1_024),
                                fullPath: z.string().min(1).max(1_024),
                                personal: z.boolean(),
                            })
                            .strict()
                            .readonly(),
                    )
                    .max(1_000)
                    .readonly(),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("shareRepositories"),
                canCreatePrivate: z.boolean(),
                names: z.array(RepositoryNameSchema).max(10_000).readonly(),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("repositoryAvailability"),
                exists: z.boolean(),
            })
            .strict()
            .readonly(),
        z
            .object({
                kind: z.literal("repository"),
                project: ProjectSchema,
                webUrl: HostedRepositoryUrlSchema,
                cloneUrl: HostedRepositoryUrlSchema,
                sshUrl: z.string().min(1).max(MAX_URL_CHARACTERS).nullable(),
            })
            .strict()
            .readonly(),
    ])
    .readonly();
export type HostingResponse = Readonly<z.infer<typeof HostingResponseSchema>>;

export const HostingResponseKindByRequest = {
    list: "changeRequests",
    get: "changeRequest",
    files: "files",
    timeline: "timeline",
    viewedFiles: "viewedFiles",
    setViewed: "completed",
    create: "changeRequest",
    comment: "completed",
    review: "completed",
    updateBranch: "completed",
    syncFork: "completed",
    listNamespaces: "namespaces",
    listShareRepositories: "shareRepositories",
    checkShareRepository: "repositoryAvailability",
    shareRepository: "repository",
} as const satisfies Readonly<
    Record<HostingRequest["kind"], HostingResponse["kind"]>
>;
