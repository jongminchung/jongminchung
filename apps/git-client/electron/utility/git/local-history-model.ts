import { z } from "zod";
import {
    GitLocalHistoryActivitySchema,
    GitRelativePathSchema,
    RepositoryIdSchema,
    type GitLocalHistoryActivity,
    type GitLocalHistoryChange,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";

export const LOCAL_HISTORY_STORAGE_VERSION = 2;
export const LOCAL_HISTORY_RETENTION_MS = 5 * 24 * 60 * 60 * 1_000;
export const DEFAULT_LOCAL_HISTORY_PAGE_SIZE = 100;
export const MAX_LOCAL_HISTORY_ACTIVITY_COUNT = 20_000;
export const LOCAL_HISTORY_ACTIVITY_GROUP_WINDOW_MS = 2_000;

const TEXT_EXTENSIONS = new Set([
    "",
    "c",
    "cc",
    "conf",
    "cpp",
    "css",
    "csv",
    "go",
    "graphql",
    "h",
    "hpp",
    "html",
    "ini",
    "java",
    "js",
    "json",
    "jsx",
    "kt",
    "kts",
    "less",
    "log",
    "lua",
    "md",
    "mdx",
    "mjs",
    "mts",
    "properties",
    "py",
    "rb",
    "rs",
    "scss",
    "sh",
    "sql",
    "svg",
    "toml",
    "ts",
    "tsx",
    "txt",
    "xml",
    "yaml",
    "yml",
    "zsh",
]);

export const ContentReferenceSchema = z.discriminatedUnion("kind", [
    z
        .object({
            kind: z.literal("git"),
            oid: z.string().regex(/^[0-9a-f]{40,64}$/u),
        })
        .strict(),
    z
        .object({
            kind: z.literal("blob"),
            sha256: z.string().regex(/^[0-9a-f]{64}$/u),
        })
        .strict(),
    z.object({ kind: z.literal("unavailable") }).strict(),
]);
export type ContentReference = Readonly<z.infer<typeof ContentReferenceSchema>>;

export const FileStateSchema = z
    .object({
        kind: z.enum(["file", "symlink"]),
        mode: z.number().int().min(0).max(0o777),
        contentType: z.enum(["text", "binary"]),
        content: ContentReferenceSchema,
    })
    .strict();
export type FileState = Readonly<z.infer<typeof FileStateSchema>>;
export type OptionalFileState = FileState | null;

export const StoredChangeSchema = z
    .object({
        kind: z.enum([
            "content",
            "create",
            "delete",
            "move",
            "rename",
            "readOnly",
        ]),
        path: GitRelativePathSchema,
        previousPath: GitRelativePathSchema.nullable(),
        before: FileStateSchema.nullable(),
        after: FileStateSchema.nullable(),
    })
    .strict();
export type StoredChange = Readonly<z.infer<typeof StoredChangeSchema>>;

export const StoredActivitySchema = z
    .object({
        version: z.literal(LOCAL_HISTORY_STORAGE_VERSION),
        id: z.string().uuid(),
        repositoryId: RepositoryIdSchema,
        createdAtMs: z.number().int().nonnegative().safe(),
        name: z.string().min(1).max(16_384),
        label: z.string().min(1).max(16_384).nullable(),
        system: z.boolean(),
        changes: z
            .array(StoredChangeSchema)
            .max(MAX_LOCAL_HISTORY_ACTIVITY_COUNT),
    })
    .strict();
export type StoredActivity = Readonly<z.infer<typeof StoredActivitySchema>>;

export const ManifestSchema = z
    .object({
        version: z.literal(LOCAL_HISTORY_STORAGE_VERSION),
        activityIds: z
            .array(z.string().uuid())
            .max(MAX_LOCAL_HISTORY_ACTIVITY_COUNT),
    })
    .strict();
export type LocalHistoryManifest = Readonly<z.infer<typeof ManifestSchema>>;

export const CurrentStateSchema = z
    .object({
        version: z.literal(LOCAL_HISTORY_STORAGE_VERSION),
        files: z
            .array(z.tuple([GitRelativePathSchema, FileStateSchema]))
            .max(100_000),
    })
    .strict();

export const LegacyEntrySchema = z
    .object({
        id: z.string().uuid(),
        repositoryId: RepositoryIdSchema,
        createdAtMs: z.number().int().nonnegative().safe(),
        label: z.string().nullable(),
        snapshotFile: z.string().uuid(),
    })
    .passthrough();
export const LegacyManifestSchema = z
    .object({ version: z.literal(1), entries: z.array(LegacyEntrySchema) })
    .passthrough();
export const LegacySnapshotSchema = z
    .object({
        files: z.array(
            z
                .object({
                    path: GitRelativePathSchema,
                    kind: z.enum(["file", "symlink"]),
                    mode: z.number().int().min(0).max(0o777),
                    bytesBase64: z.string(),
                })
                .passthrough(),
        ),
    })
    .passthrough();

function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

function stateIdentity(state: OptionalFileState): string {
    if (state === null) return "missing";
    const content =
        state.content.kind === "git"
            ? state.content.oid
            : state.content.kind === "blob"
              ? state.content.sha256
              : "unavailable";
    return `${state.kind}:${state.mode}:${state.contentType}:${state.content.kind}:${content}`;
}

export function isLocalHistoryTextPath(path: string): boolean {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const index = name.lastIndexOf(".");
    return TEXT_EXTENSIONS.has(
        index < 0 ? "" : name.slice(index + 1).toLowerCase(),
    );
}

export function publicLocalHistoryChange(
    change: StoredChange,
): GitLocalHistoryChange {
    const contentAvailability: GitLocalHistoryChange["contentAvailability"] =
        change.kind === "readOnly"
            ? "notApplicable"
            : change.before?.contentType === "binary" ||
                change.after?.contentType === "binary" ||
                change.before?.content.kind === "unavailable" ||
                change.after?.content.kind === "unavailable"
              ? "unavailable"
              : "available";
    const base = { path: change.path, contentAvailability } as const;
    if (change.kind === "move" || change.kind === "rename") {
        if (change.previousPath === null)
            throw invalid("Local History move is missing its source path");
        return {
            ...base,
            kind: change.kind,
            previousPath: change.previousPath,
        };
    }
    if (change.kind === "readOnly") {
        return {
            ...base,
            kind: change.kind,
            readOnly: (change.after?.mode ?? 0) & 0o200 ? false : true,
        };
    }
    return { ...base, kind: change.kind };
}

export function publicLocalHistoryActivity(
    activity: StoredActivity,
): GitLocalHistoryActivity {
    const paths = [
        ...new Set(activity.changes.map((change) => change.path)),
    ].sort();
    return GitLocalHistoryActivitySchema.parse({
        id: activity.id,
        repositoryId: activity.repositoryId,
        createdAtMs: activity.createdAtMs,
        name: activity.name,
        label: activity.label,
        system: activity.system,
        paths,
        changeCount: activity.changes.length,
    });
}

export function createLocalHistoryChanges(
    previous: ReadonlyMap<string, FileState>,
    current: ReadonlyMap<string, FileState>,
): readonly StoredChange[] {
    const directory = (path: string): string => {
        const separator = path.lastIndexOf("/");
        return separator < 0 ? "" : path.slice(0, separator);
    };
    const deleted = [...previous.keys()].filter((path) => !current.has(path));
    const created = [...current.keys()].filter((path) => !previous.has(path));
    const consumedCreated = new Set<string>();
    const changes: StoredChange[] = [];
    for (const oldPath of deleted) {
        const before = previous.get(oldPath) ?? null;
        const movedPath = created.find(
            (path) =>
                !consumedCreated.has(path) &&
                stateIdentity(current.get(path) ?? null) ===
                    stateIdentity(before),
        );
        if (movedPath !== undefined) {
            consumedCreated.add(movedPath);
            changes.push({
                kind:
                    directory(oldPath) === directory(movedPath)
                        ? "rename"
                        : "move",
                path: movedPath,
                previousPath: oldPath,
                before,
                after: current.get(movedPath) ?? null,
            });
        } else {
            changes.push({
                kind: "delete",
                path: oldPath,
                previousPath: null,
                before,
                after: null,
            });
        }
    }
    for (const path of created) {
        if (consumedCreated.has(path)) continue;
        changes.push({
            kind: "create",
            path,
            previousPath: null,
            before: null,
            after: current.get(path) ?? null,
        });
    }
    for (const [path, after] of current) {
        const before = previous.get(path);
        if (before === undefined) continue;
        if (
            before.mode !== after.mode &&
            stateIdentity({ ...before, mode: after.mode }) ===
                stateIdentity(after)
        ) {
            changes.push({
                kind: "readOnly",
                path,
                previousPath: null,
                before,
                after,
            });
        } else if (stateIdentity(before) !== stateIdentity(after)) {
            changes.push({
                kind: "content",
                path,
                previousPath: null,
                before,
                after,
            });
        }
    }
    return changes.sort((left, right) => left.path.localeCompare(right.path));
}
