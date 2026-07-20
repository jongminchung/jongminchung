import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { z } from "zod";
import {
  GitLocalHistoryActivitiesPageSchema,
  GitLocalHistoryActivityDetailSchema,
  GitLocalHistoryActivitySchema,
  GitLocalHistoryScopeSchema,
  GitRelativePathSchema,
  RepositoryIdSchema,
  type GitLocalHistoryActivitiesPage,
  type GitLocalHistoryActivity,
  type GitLocalHistoryActivityDetail,
  type GitLocalHistoryChange,
  type GitLocalHistoryScope,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessOutcome, GitProcessRunnerLike } from "./git-process";
import type { RepositoryRegistry } from "./repository-registry";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const STORAGE_VERSION = 2;
const RETENTION_MS = 5 * 24 * 60 * 60 * 1_000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_ACTIVITY_COUNT = 20_000;
const ACTIVITY_GROUP_WINDOW_MS = 2_000;
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

const ContentReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("git"), oid: z.string().regex(/^[0-9a-f]{40,64}$/u) }).strict(),
  z.object({ kind: z.literal("blob"), sha256: z.string().regex(/^[0-9a-f]{64}$/u) }).strict(),
  z.object({ kind: z.literal("unavailable") }).strict(),
]);
type ContentReference = Readonly<z.infer<typeof ContentReferenceSchema>>;

const FileStateSchema = z
  .object({
    kind: z.enum(["file", "symlink"]),
    mode: z.number().int().min(0).max(0o777),
    contentType: z.enum(["text", "binary"]),
    content: ContentReferenceSchema,
  })
  .strict();
type FileState = Readonly<z.infer<typeof FileStateSchema>>;
type OptionalFileState = FileState | null;

const StoredChangeSchema = z
  .object({
    kind: z.enum(["content", "create", "delete", "move", "rename", "readOnly"]),
    path: GitRelativePathSchema,
    previousPath: GitRelativePathSchema.nullable(),
    before: FileStateSchema.nullable(),
    after: FileStateSchema.nullable(),
  })
  .strict();
type StoredChange = Readonly<z.infer<typeof StoredChangeSchema>>;

const StoredActivitySchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    id: z.string().uuid(),
    repositoryId: RepositoryIdSchema,
    createdAtMs: z.number().int().nonnegative().safe(),
    name: z.string().min(1).max(16_384),
    label: z.string().min(1).max(16_384).nullable(),
    system: z.boolean(),
    changes: z.array(StoredChangeSchema).max(MAX_ACTIVITY_COUNT),
  })
  .strict();
type StoredActivity = Readonly<z.infer<typeof StoredActivitySchema>>;

const ManifestSchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    activityIds: z.array(z.string().uuid()).max(MAX_ACTIVITY_COUNT),
  })
  .strict();
type Manifest = Readonly<z.infer<typeof ManifestSchema>>;

const CurrentStateSchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    files: z.array(z.tuple([GitRelativePathSchema, FileStateSchema])).max(100_000),
  })
  .strict();

const LegacyEntrySchema = z
  .object({
    id: z.string().uuid(),
    repositoryId: RepositoryIdSchema,
    createdAtMs: z.number().int().nonnegative().safe(),
    label: z.string().nullable(),
    snapshotFile: z.string().uuid(),
  })
  .passthrough();
const LegacyManifestSchema = z
  .object({ version: z.literal(1), entries: z.array(LegacyEntrySchema) })
  .passthrough();
const LegacySnapshotSchema = z
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

function commandFailure(outcome: GitProcessOutcome): GitUtilityError {
  if (outcome.kind === "failed")
    return new GitUtilityError(outcome.code, outcome.message, outcome.exitCode);
  if (outcome.kind === "cancelled") {
    return new GitUtilityError(
      "commandFailed",
      `Local History command was cancelled (${outcome.reason})`,
    );
  }
  return new GitUtilityError(
    "commandFailed",
    "Local History command did not complete successfully",
  );
}

function processOutput(outcome: GitProcessOutcome, stream: "stdout" | "stderr"): string {
  return outcome.output
    .filter((item) => item.stream === stream)
    .map((item) => item.data)
    .join("");
}

function isErrno(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
  );
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extension(path));
}

async function looksLikeText(path: string): Promise<boolean> {
  const handle = await open(path, "r");
  try {
    const sample = Buffer.alloc(8 * 1024);
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
    const bytes = sample.subarray(0, bytesRead);
    return !bytes.includes(0) && isUtf8(bytes);
  } finally {
    await handle.close();
  }
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

function contentAvailability(change: StoredChange): GitLocalHistoryChange["contentAvailability"] {
  if (change.kind === "readOnly") return "notApplicable";
  return change.before?.contentType === "binary" ||
    change.after?.contentType === "binary" ||
    change.before?.content.kind === "unavailable" ||
    change.after?.content.kind === "unavailable"
    ? "unavailable"
    : "available";
}

function publicChange(change: StoredChange): GitLocalHistoryChange {
  const base = { path: change.path, contentAvailability: contentAvailability(change) } as const;
  if (change.kind === "move" || change.kind === "rename") {
    if (change.previousPath === null)
      throw invalid("Local History move is missing its source path");
    return { ...base, kind: change.kind, previousPath: change.previousPath };
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

function publicActivity(activity: StoredActivity): GitLocalHistoryActivity {
  const paths = [...new Set(activity.changes.map((change) => change.path))].sort();
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

function contained(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

function parseNul(value: string): readonly string[] {
  if (value.length === 0) return [];
  if (!value.endsWith("\0")) throw invalid("Git returned an invalid path list");
  return value
    .slice(0, -1)
    .split("\0")
    .map((path) => GitRelativePathSchema.parse(path));
}

function parseIndex(value: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  if (value.length > 0 && !value.endsWith("\0")) throw invalid("Git returned an invalid index");
  for (const record of value.length === 0 ? [] : value.slice(0, -1).split("\0")) {
    const tab = record.indexOf("\t");
    const header = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    if (tab < 0 || header.length !== 3 || header[2] !== "0") continue;
    const oid = header[1];
    if (oid !== undefined) result.set(GitRelativePathSchema.parse(path), oid);
  }
  return result;
}

function parseDirty(value: string): ReadonlySet<string> {
  const records = value.length === 0 ? [] : value.slice(0, -1).split("\0");
  const paths = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length < 4) continue;
    const path = GitRelativePathSchema.parse(record.slice(3));
    paths.add(path);
    if (record[0] === "R" || record[0] === "C" || record[1] === "R" || record[1] === "C") {
      const previous = records[index + 1];
      if (previous !== undefined) paths.add(GitRelativePathSchema.parse(previous));
      index += 1;
    }
  }
  return paths;
}

function createChanges(
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
        stateIdentity(current.get(path) ?? null) === stateIdentity(before),
    );
    if (movedPath !== undefined) {
      consumedCreated.add(movedPath);
      changes.push({
        kind: directory(oldPath) === directory(movedPath) ? "rename" : "move",
        path: movedPath,
        previousPath: oldPath,
        before,
        after: current.get(movedPath) ?? null,
      });
    } else {
      changes.push({ kind: "delete", path: oldPath, previousPath: null, before, after: null });
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
      stateIdentity({ ...before, mode: after.mode }) === stateIdentity(after)
    ) {
      changes.push({ kind: "readOnly", path, previousPath: null, before, after });
    } else if (stateIdentity(before) !== stateIdentity(after)) {
      changes.push({ kind: "content", path, previousPath: null, before, after });
    }
  }
  return changes.sort((left, right) => left.path.localeCompare(right.path));
}

export class LocalHistoryService {
  readonly #registry: RepositoryRegistry;
  readonly #storageRoot: string;
  readonly #runner: GitProcessRunnerLike;
  readonly #now: () => number;
  readonly #mutations = new Map<RepositoryId, Promise<void>>();

  private constructor(
    registry: RepositoryRegistry,
    storageRoot: string,
    runner: GitProcessRunnerLike,
    now: () => number,
  ) {
    if (!isAbsolute(storageRoot)) throw invalid("Local History storage root must be absolute");
    this.#registry = registry;
    this.#storageRoot = storageRoot;
    this.#runner = runner;
    this.#now = now;
  }

  static of(
    registry: RepositoryRegistry,
    storageRoot: string,
    runner: GitProcessRunnerLike,
    now: () => number = Date.now,
  ): LocalHistoryService {
    return new LocalHistoryService(registry, storageRoot, runner, now);
  }

  async initialize(repositoryId: RepositoryId, signal?: AbortSignal): Promise<void> {
    const id = RepositoryIdSchema.parse(repositoryId);
    await this.#serialize(id, async () => {
      await this.#archiveLegacy(id);
      try {
        const current = await this.#readCurrent(id);
        if (current.size === 0) await this.#writeCurrent(id, await this.#captureState(id, signal));
        await this.#purge(id);
      } catch (error) {
        if (
          !(error instanceof z.ZodError) &&
          !(error instanceof SyntaxError) &&
          !isErrno(error, "ENOENT")
        ) {
          throw error;
        }
        await this.#quarantineCorruptRepository(id);
        await this.#writeCurrent(id, await this.#captureState(id, signal));
      }
    });
  }

  async record(
    repositoryId: RepositoryId,
    name: string,
    system = false,
    signal?: AbortSignal,
  ): Promise<GitLocalHistoryActivity | null> {
    const id = RepositoryIdSchema.parse(repositoryId);
    return this.#serialize(id, async () => {
      const previous = await this.#readCurrent(id);
      const current = await this.#captureState(id, signal);
      if (previous.size === 0) {
        await this.#writeCurrent(id, current);
        return null;
      }
      const changes = createChanges(previous, current);
      await this.#writeCurrent(id, current);
      if (changes.length === 0) return null;
      return this.#append(id, name, null, system, changes);
    });
  }

  async putLabel(repositoryId: RepositoryId, label: string): Promise<GitLocalHistoryActivity> {
    const id = RepositoryIdSchema.parse(repositoryId);
    const value = label.trim();
    if (value.length === 0) throw invalid("Local History label must not be empty");
    return this.#serialize(id, () => this.#append(id, value, value, false, []));
  }

  async list(
    scope: GitLocalHistoryScope,
    cursor: string | null,
    limit = DEFAULT_PAGE_SIZE,
    query = "",
    showSystemEvents = true,
  ): Promise<GitLocalHistoryActivitiesPage> {
    const parsed = GitLocalHistoryScopeSchema.parse(scope);
    const manifest = await this.#readManifest(parsed.repositoryId);
    const activities = await Promise.all(
      manifest.activityIds.map((id) => this.#readActivity(parsed.repositoryId, id)),
    );
    const needle = query.trim().toLocaleLowerCase();
    const filtered = activities.filter((activity) => {
      if (!showSystemEvents && activity.system) return false;
      if (parsed.kind === "file" && !activity.changes.some((change) => change.path === parsed.path))
        return false;
      if (needle.length === 0) return true;
      return (
        activity.name.toLocaleLowerCase().includes(needle) ||
        activity.changes.some((change) => change.path.toLocaleLowerCase().includes(needle))
      );
    });
    const start =
      cursor === null ? 0 : Math.max(0, filtered.findIndex((item) => item.id === cursor) + 1);
    const page = filtered.slice(start, start + limit);
    return GitLocalHistoryActivitiesPageSchema.parse({
      activities: page.map(publicActivity),
      nextCursor: start + limit < filtered.length ? (page.at(-1)?.id ?? null) : null,
    });
  }

  async detail(
    repositoryId: RepositoryId,
    activityId: string,
  ): Promise<GitLocalHistoryActivityDetail> {
    const activity = await this.#readActivity(RepositoryIdSchema.parse(repositoryId), activityId);
    return GitLocalHistoryActivityDetailSchema.parse({
      activity: publicActivity(activity),
      changes: activity.changes.map(publicChange),
    });
  }

  async diff(
    repositoryId: RepositoryId,
    activityId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const id = RepositoryIdSchema.parse(repositoryId);
    const safePath = GitRelativePathSchema.parse(path);
    const activity = await this.#readActivity(id, activityId);
    const change = activity.changes.find(
      (candidate) => candidate.path === safePath || candidate.previousPath === safePath,
    );
    if (change === undefined) return "";
    const [before, after] = await Promise.all([
      this.#readContent(id, change.before, signal),
      this.#readContent(id, change.after, signal),
    ]);
    if (before === null || after === null)
      return `Binary or unavailable content changed: ${safePath}`;
    if (before.equals(after)) return "";
    const beforeLines = before.toString("utf8").split(/\r?\n/u);
    const afterLines = after.toString("utf8").split(/\r?\n/u);
    return [
      `--- Local History/${change.previousPath ?? safePath}`,
      `+++ Current/${safePath}`,
      `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
      ...beforeLines.map((line) => `-${line}`),
      ...afterLines.map((line) => `+${line}`),
    ].join("\n");
  }

  async createPatch(
    repositoryId: RepositoryId,
    activityId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<string> {
    const detail = await this.detail(repositoryId, activityId);
    const selected =
      paths.length === 0
        ? detail.activity.paths
        : paths.map((path) => GitRelativePathSchema.parse(path));
    const patches = await Promise.all(
      selected.map((path) => this.diff(repositoryId, activityId, path, signal)),
    );
    return patches.filter(Boolean).join("\n\n");
  }

  async revert(
    repositoryId: RepositoryId,
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    const id = RepositoryIdSchema.parse(repositoryId);
    await this.#serialize(id, async () => {
      const beforeRevert = await this.#captureState(id, signal);
      const manifest = await this.#readManifest(id);
      const index = manifest.activityIds.indexOf(activityId);
      if (index < 0) throw invalid("Local History activity does not exist");
      const activities = await Promise.all(
        manifest.activityIds
          .slice(0, includeLater ? index + 1 : 1)
          .map((value) => this.#readActivity(id, includeLater ? value : activityId)),
      );
      const selected = new Set(paths.map((path) => GitRelativePathSchema.parse(path)));
      for (const activity of activities) {
        for (const change of activity.changes) {
          if (
            selected.size > 0 &&
            !selected.has(change.path) &&
            (change.previousPath === null || !selected.has(change.previousPath))
          )
            continue;
          await this.#restoreState(id, change.previousPath ?? change.path, change.before, signal);
          if (change.previousPath !== null && change.previousPath !== change.path) {
            await this.#restoreState(id, change.path, null, signal);
          }
        }
      }
      const afterRevert = await this.#captureState(id, signal);
      await this.#writeCurrent(id, afterRevert);
      const changes = createChanges(beforeRevert, afterRevert);
      if (changes.length > 0) {
        await this.#append(id, "Revert Local History", null, true, changes);
      }
    });
  }

  async #append(
    repositoryId: RepositoryId,
    name: string,
    label: string | null,
    system: boolean,
    changes: readonly StoredChange[],
  ): Promise<GitLocalHistoryActivity> {
    const manifest = await this.#readManifest(repositoryId);
    const latestId = manifest.activityIds[0];
    if (latestId !== undefined && label === null && changes.length > 0) {
      const latest = await this.#readActivity(repositoryId, latestId);
      if (
        latest.label === null &&
        latest.name === name &&
        latest.system === system &&
        this.#now() - latest.createdAtMs <= ACTIVITY_GROUP_WINDOW_MS
      ) {
        const grouped = StoredActivitySchema.parse({
          ...latest,
          changes: [...latest.changes, ...changes],
        });
        await this.#atomicJson(
          join(this.#repositoryDirectory(repositoryId), "activities", `${latest.id}.json`),
          grouped,
        );
        await this.#purge(repositoryId);
        return publicActivity(grouped);
      }
    }
    const activity = StoredActivitySchema.parse({
      version: STORAGE_VERSION,
      id: randomUUID(),
      repositoryId,
      createdAtMs: this.#now(),
      name,
      label,
      system,
      changes,
    });
    const directory = this.#repositoryDirectory(repositoryId);
    await mkdir(join(directory, "activities"), { recursive: true, mode: 0o700 });
    await this.#atomicJson(join(directory, "activities", `${activity.id}.json`), activity);
    await this.#writeManifest(repositoryId, [activity.id, ...manifest.activityIds]);
    await this.#purge(repositoryId);
    return publicActivity(activity);
  }

  async #captureState(
    repositoryId: RepositoryId,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, FileState>> {
    const repository = this.#registry.get(repositoryId);
    const [indexText, untrackedText, statusText] = await Promise.all([
      this.#git(repository.path, ["ls-files", "--stage", "-z", "--"], signal),
      this.#git(
        repository.path,
        ["ls-files", "--others", "--exclude-standard", "-z", "--"],
        signal,
      ),
      this.#git(
        repository.path,
        ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--"],
        signal,
      ),
    ]);
    const indexed = parseIndex(indexText);
    const untracked = parseNul(untrackedText);
    const dirty = parseDirty(statusText);
    const paths = [...new Set([...indexed.keys(), ...untracked])].sort();
    const state = new Map<string, FileState>();
    for (const path of paths) {
      if (signal?.aborted === true)
        throw new GitUtilityError("commandFailed", "Local History was cancelled");
      const absolute = join(repository.path, ...path.split("/"));
      if (!contained(repository.path, absolute))
        throw invalid("Local History path escaped the project");
      let metadata;
      try {
        metadata = await lstat(absolute);
      } catch (error) {
        if (isErrno(error, "ENOENT")) continue;
        throw error;
      }
      if (!metadata.isFile() && !metadata.isSymbolicLink()) continue;
      const mode = metadata.mode & 0o777;
      let contentType: FileState["contentType"] = "binary";
      try {
        contentType =
          metadata.isSymbolicLink() || isTextPath(path) || (await looksLikeText(absolute))
            ? "text"
            : "binary";
      } catch {
        contentType = "binary";
      }
      if (!dirty.has(path) && indexed.has(path)) {
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "git", oid: indexed.get(path) ?? "" },
        });
        continue;
      }
      try {
        if (contentType === "binary") {
          state.set(path, {
            kind: "file",
            mode,
            contentType,
            content: { kind: "unavailable" },
          });
          continue;
        }
        const bytes = metadata.isSymbolicLink()
          ? Buffer.from(await readlink(absolute))
          : await readFile(absolute);
        const sha256 = await this.#writeBlob(bytes);
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "blob", sha256 },
        });
      } catch {
        state.set(path, {
          kind: metadata.isSymbolicLink() ? "symlink" : "file",
          mode,
          contentType,
          content: { kind: "unavailable" },
        });
      }
    }
    return state;
  }

  async #git(cwd: string, args: readonly string[], signal?: AbortSignal): Promise<string> {
    const outcome = await this.#runner.run(
      { cwd, args, redactStdout: false, outputLimitBytes: 32 * 1024 * 1024 },
      signal,
    );
    if (outcome.kind !== "completed") throw commandFailure(outcome);
    return processOutput(outcome, "stdout");
  }

  async #readContent(
    repositoryId: RepositoryId,
    state: OptionalFileState,
    signal?: AbortSignal,
  ): Promise<Buffer | null> {
    if (state === null) return Buffer.alloc(0);
    if (state.contentType === "binary") return null;
    if (state.content.kind === "unavailable") return null;
    if (state.content.kind === "blob") {
      return gunzipAsync(await readFile(this.#blobPath(state.content.sha256)));
    }
    const repository = this.#registry.get(repositoryId);
    const outcome = await this.#runner.run(
      {
        cwd: repository.path,
        args: ["cat-file", "blob", state.content.oid],
        redactStdout: false,
        outputLimitBytes: 256 * 1024 * 1024,
      },
      signal,
    );
    if (outcome.kind !== "completed") return null;
    return Buffer.from(processOutput(outcome, "stdout"), "utf8");
  }

  async #restoreState(
    repositoryId: RepositoryId,
    path: string,
    state: OptionalFileState,
    signal?: AbortSignal,
  ): Promise<void> {
    const repository = this.#registry.get(repositoryId);
    const safePath = GitRelativePathSchema.parse(path);
    const absolute = join(repository.path, ...safePath.split("/"));
    if (!contained(repository.path, absolute))
      throw invalid("Local History restore escaped the project");
    if (state === null) {
      await rm(absolute, { force: true });
      return;
    }
    const bytes = await this.#readContent(repositoryId, state, signal);
    if (bytes === null) throw invalid(`Content for ${safePath} was not stored in Local History`);
    await mkdir(join(absolute, ".."), { recursive: true });
    const temporary = `${absolute}.local-history-${randomUUID()}`;
    if (state.kind === "symlink") {
      await symlink(bytes.toString("utf8"), temporary);
    } else {
      await writeFile(temporary, bytes, { mode: state.mode });
      await chmod(temporary, state.mode);
    }
    await rename(temporary, absolute);
  }

  async #readCurrent(repositoryId: RepositoryId): Promise<ReadonlyMap<string, FileState>> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.#repositoryDirectory(repositoryId), "current.json"), "utf8"),
      );
      const parsed = CurrentStateSchema.parse(raw);
      return new Map<string, FileState>(
        parsed.files.map(([path, state]) => [path, state] as const),
      );
    } catch (error) {
      if (isErrno(error, "ENOENT")) return new Map();
      throw error;
    }
  }

  async #writeCurrent(
    repositoryId: RepositoryId,
    state: ReadonlyMap<string, FileState>,
  ): Promise<void> {
    await mkdir(this.#repositoryDirectory(repositoryId), { recursive: true, mode: 0o700 });
    await this.#atomicJson(join(this.#repositoryDirectory(repositoryId), "current.json"), {
      version: STORAGE_VERSION,
      files: [...state.entries()],
    });
  }

  async #readManifest(repositoryId: RepositoryId): Promise<Manifest> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.#repositoryDirectory(repositoryId), "manifest.json"), "utf8"),
      );
      return ManifestSchema.parse(raw);
    } catch (error) {
      if (isErrno(error, "ENOENT")) return { version: STORAGE_VERSION, activityIds: [] };
      throw error;
    }
  }

  async #writeManifest(repositoryId: RepositoryId, activityIds: readonly string[]): Promise<void> {
    await this.#atomicJson(join(this.#repositoryDirectory(repositoryId), "manifest.json"), {
      version: STORAGE_VERSION,
      activityIds,
    });
  }

  async #readActivity(repositoryId: RepositoryId, activityId: string): Promise<StoredActivity> {
    const raw: unknown = JSON.parse(
      await readFile(
        join(this.#repositoryDirectory(repositoryId), "activities", `${activityId}.json`),
        "utf8",
      ),
    );
    return StoredActivitySchema.parse(raw);
  }

  async #writeBlob(bytes: Buffer): Promise<string> {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const target = this.#blobPath(sha256);
    await mkdir(join(this.#storageDirectory(), "objects"), { recursive: true, mode: 0o700 });
    try {
      await writeFile(target, await gzipAsync(bytes), { mode: 0o600, flag: "wx" });
    } catch (error) {
      if (!isErrno(error, "EEXIST")) throw error;
    }
    return sha256;
  }

  async #purge(repositoryId: RepositoryId): Promise<void> {
    const manifest = await this.#readManifest(repositoryId);
    const cutoff = this.#now() - RETENTION_MS;
    const retained: string[] = [];
    for (const id of manifest.activityIds) {
      const activity = await this.#readActivity(repositoryId, id);
      if (activity.createdAtMs >= cutoff) retained.push(id);
      else
        await rm(join(this.#repositoryDirectory(repositoryId), "activities", `${id}.json`), {
          force: true,
        });
    }
    if (retained.length !== manifest.activityIds.length) {
      await this.#writeManifest(repositoryId, retained);
      await this.#collectUnreferencedBlobs();
    }
  }

  async #collectUnreferencedBlobs(): Promise<void> {
    const repositoriesDirectory = join(this.#storageDirectory(), "repositories");
    const referenced = new Set<string>();
    try {
      const repositories = await readdir(repositoriesDirectory, { withFileTypes: true });
      for (const repository of repositories) {
        if (!repository.isDirectory()) continue;
        const repositoryId = RepositoryIdSchema.safeParse(repository.name);
        if (!repositoryId.success) continue;
        const current = await this.#readCurrent(repositoryId.data);
        for (const state of current.values()) {
          if (state.content.kind === "blob") referenced.add(state.content.sha256);
        }
        const manifest = await this.#readManifest(repositoryId.data);
        for (const activityId of manifest.activityIds) {
          const activity = await this.#readActivity(repositoryId.data, activityId);
          for (const change of activity.changes) {
            for (const state of [change.before, change.after]) {
              if (state?.content.kind === "blob") referenced.add(state.content.sha256);
            }
          }
        }
      }
      const objectsDirectory = join(this.#storageDirectory(), "objects");
      const objects = await readdir(objectsDirectory, { withFileTypes: true });
      await Promise.all(
        objects
          .filter((object) => object.isFile() && object.name.endsWith(".gz"))
          .filter((object) => !referenced.has(object.name.slice(0, -3)))
          .map((object) => rm(join(objectsDirectory, object.name), { force: true })),
      );
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }

  async #archiveLegacy(repositoryId: RepositoryId): Promise<void> {
    const legacy = join(this.#storageRoot, "local-history", repositoryId);
    try {
      const raw: unknown = JSON.parse(await readFile(join(legacy, "manifest.json"), "utf8"));
      const manifest = LegacyManifestSchema.parse(raw);
      const snapshots: Array<{
        readonly entry: z.infer<typeof LegacyEntrySchema>;
        readonly state: ReadonlyMap<string, FileState>;
      }> = [];
      for (const entry of [...manifest.entries].reverse()) {
        const snapshotRaw: unknown = JSON.parse(
          await readFile(join(legacy, `${entry.snapshotFile}.json`), "utf8"),
        );
        const snapshot = LegacySnapshotSchema.parse(snapshotRaw);
        const files = new Map<string, FileState>();
        for (const file of snapshot.files) {
          const bytes = Buffer.from(file.bytesBase64, "base64");
          const content: ContentReference =
            file.kind === "symlink" || (isTextPath(file.path) && isUtf8(bytes))
              ? { kind: "blob", sha256: await this.#writeBlob(bytes) }
              : { kind: "unavailable" };
          files.set(file.path, {
            kind: file.kind,
            mode: file.mode,
            contentType: content.kind === "unavailable" ? "binary" : "text",
            content,
          });
        }
        snapshots.push({ entry, state: files });
      }
      const migrated: StoredActivity[] = [];
      const initial = snapshots[0];
      if (initial?.entry.label) {
        migrated.push(
          StoredActivitySchema.parse({
            version: STORAGE_VERSION,
            id: initial.entry.id,
            repositoryId,
            createdAtMs: initial.entry.createdAtMs,
            name: initial.entry.label,
            label: initial.entry.label,
            system: false,
            changes: [],
          }),
        );
      }
      for (let index = 1; index < snapshots.length; index += 1) {
        const previous = snapshots[index - 1];
        const current = snapshots[index];
        if (previous === undefined || current === undefined) continue;
        const changes = createChanges(previous.state, current.state);
        if (changes.length === 0 && current.entry.label === null) continue;
        migrated.push(
          StoredActivitySchema.parse({
            version: STORAGE_VERSION,
            id: current.entry.id,
            repositoryId,
            createdAtMs: current.entry.createdAtMs,
            name: current.entry.label ?? "Migrated Local History",
            label: current.entry.label,
            system: false,
            changes,
          }),
        );
      }
      if (migrated.length > 0) {
        const activityDirectory = join(this.#repositoryDirectory(repositoryId), "activities");
        await mkdir(activityDirectory, { recursive: true, mode: 0o700 });
        for (const activity of migrated) {
          await this.#atomicJson(join(activityDirectory, `${activity.id}.json`), activity);
        }
        await this.#writeManifest(repositoryId, migrated.map((activity) => activity.id).reverse());
      }
      const archive = join(this.#storageRoot, "local-history-v1-archive");
      await mkdir(archive, { recursive: true, mode: 0o700 });
      await rename(legacy, join(archive, repositoryId)).catch((error: unknown) => {
        if (!isErrno(error, "EEXIST")) throw error;
      });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) return;
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }

  async #quarantineCorruptRepository(repositoryId: RepositoryId): Promise<void> {
    const source = this.#repositoryDirectory(repositoryId);
    const archive = join(this.#storageRoot, "local-history-v2-corrupt");
    await mkdir(archive, { recursive: true, mode: 0o700 });
    await rename(source, join(archive, `${repositoryId}-${randomUUID()}`)).catch(
      (error: unknown) => {
        if (!isErrno(error, "ENOENT")) throw error;
      },
    );
  }

  async #atomicJson(target: string, value: unknown): Promise<void> {
    await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, target);
  }

  async #serialize<T>(repositoryId: RepositoryId, operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutations.get(repositoryId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const settled = current.then(
      () => undefined,
      () => undefined,
    );
    this.#mutations.set(repositoryId, settled);
    try {
      return await current;
    } finally {
      if (this.#mutations.get(repositoryId) === settled) this.#mutations.delete(repositoryId);
    }
  }

  #storageDirectory(): string {
    return join(this.#storageRoot, "local-history-v2");
  }

  #repositoryDirectory(repositoryId: RepositoryId): string {
    return join(this.#storageDirectory(), "repositories", RepositoryIdSchema.parse(repositoryId));
  }

  #blobPath(sha256: string): string {
    return join(this.#storageDirectory(), "objects", `${sha256}.gz`);
  }
}
