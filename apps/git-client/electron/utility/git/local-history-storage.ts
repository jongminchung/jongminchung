import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { z } from "zod";
import {
  RepositoryIdSchema,
  type GitLocalHistoryActivity,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import {
  CurrentStateSchema,
  LegacyEntrySchema,
  LegacyManifestSchema,
  LegacySnapshotSchema,
  LOCAL_HISTORY_ACTIVITY_GROUP_WINDOW_MS,
  LOCAL_HISTORY_RETENTION_MS,
  LOCAL_HISTORY_STORAGE_VERSION,
  ManifestSchema,
  StoredActivitySchema,
  createLocalHistoryChanges,
  isLocalHistoryTextPath,
  publicLocalHistoryActivity,
  type ContentReference,
  type FileState,
  type LocalHistoryManifest,
  type StoredActivity,
  type StoredChange,
} from "./local-history-model";
import { isErrno } from "./local-history-support";

const gzipAsync = promisify(gzip);
export const gunzipLocalHistory = promisify(gunzip);

export class LocalHistoryStorage {
  constructor(
    private readonly storageRoot: string,
    private readonly now: () => number,
  ) {}
  async append(
    repositoryId: RepositoryId,
    name: string,
    label: string | null,
    system: boolean,
    changes: readonly StoredChange[],
  ): Promise<GitLocalHistoryActivity> {
    const manifest = await this.readManifest(repositoryId);
    const latestId = manifest.activityIds[0];
    if (latestId !== undefined && label === null && changes.length > 0) {
      const latest = await this.readActivity(repositoryId, latestId);
      if (
        latest.label === null &&
        latest.name === name &&
        latest.system === system &&
        this.now() - latest.createdAtMs <= LOCAL_HISTORY_ACTIVITY_GROUP_WINDOW_MS
      ) {
        const grouped = StoredActivitySchema.parse({
          ...latest,
          changes: [...latest.changes, ...changes],
        });
        await this.atomicJson(
          join(this.repositoryDirectory(repositoryId), "activities", `${latest.id}.json`),
          grouped,
        );
        await this.purge(repositoryId);
        return publicLocalHistoryActivity(grouped);
      }
    }
    const activity = StoredActivitySchema.parse({
      version: LOCAL_HISTORY_STORAGE_VERSION,
      id: randomUUID(),
      repositoryId,
      createdAtMs: this.now(),
      name,
      label,
      system,
      changes,
    });
    const directory = this.repositoryDirectory(repositoryId);
    await mkdir(join(directory, "activities"), {
      recursive: true,
      mode: 0o700,
    });
    await this.atomicJson(join(directory, "activities", `${activity.id}.json`), activity);
    await this.writeManifest(repositoryId, [activity.id, ...manifest.activityIds]);
    await this.purge(repositoryId);
    return publicLocalHistoryActivity(activity);
  }

  async readCurrent(repositoryId: RepositoryId): Promise<ReadonlyMap<string, FileState>> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.repositoryDirectory(repositoryId), "current.json"), "utf8"),
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

  async writeCurrent(
    repositoryId: RepositoryId,
    state: ReadonlyMap<string, FileState>,
  ): Promise<void> {
    await mkdir(this.repositoryDirectory(repositoryId), {
      recursive: true,
      mode: 0o700,
    });
    await this.atomicJson(join(this.repositoryDirectory(repositoryId), "current.json"), {
      version: LOCAL_HISTORY_STORAGE_VERSION,
      files: [...state.entries()],
    });
  }

  async readManifest(repositoryId: RepositoryId): Promise<LocalHistoryManifest> {
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(this.repositoryDirectory(repositoryId), "manifest.json"), "utf8"),
      );
      return ManifestSchema.parse(raw);
    } catch (error) {
      if (isErrno(error, "ENOENT"))
        return {
          version: LOCAL_HISTORY_STORAGE_VERSION,
          activityIds: [],
        };
      throw error;
    }
  }

  async writeManifest(repositoryId: RepositoryId, activityIds: readonly string[]): Promise<void> {
    await this.atomicJson(join(this.repositoryDirectory(repositoryId), "manifest.json"), {
      version: LOCAL_HISTORY_STORAGE_VERSION,
      activityIds,
    });
  }

  async readActivity(repositoryId: RepositoryId, activityId: string): Promise<StoredActivity> {
    const raw: unknown = JSON.parse(
      await readFile(
        join(this.repositoryDirectory(repositoryId), "activities", `${activityId}.json`),
        "utf8",
      ),
    );
    return StoredActivitySchema.parse(raw);
  }

  async writeBlob(bytes: Buffer): Promise<string> {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const target = this.blobPath(sha256);
    await mkdir(join(this.storageDirectory(), "objects"), {
      recursive: true,
      mode: 0o700,
    });
    try {
      await writeFile(target, await gzipAsync(bytes), {
        mode: 0o600,
        flag: "wx",
      });
    } catch (error) {
      if (!isErrno(error, "EEXIST")) throw error;
    }
    return sha256;
  }

  async purge(repositoryId: RepositoryId): Promise<void> {
    const manifest = await this.readManifest(repositoryId);
    const cutoff = this.now() - LOCAL_HISTORY_RETENTION_MS;
    const retained: string[] = [];
    for (const id of manifest.activityIds) {
      const activity = await this.readActivity(repositoryId, id);
      if (activity.createdAtMs >= cutoff) retained.push(id);
      else
        await rm(join(this.repositoryDirectory(repositoryId), "activities", `${id}.json`), {
          force: true,
        });
    }
    if (retained.length !== manifest.activityIds.length) {
      await this.writeManifest(repositoryId, retained);
      await this.collectUnreferencedBlobs();
    }
  }

  async collectUnreferencedBlobs(): Promise<void> {
    const repositoriesDirectory = join(this.storageDirectory(), "repositories");
    const referenced = new Set<string>();
    try {
      const repositories = await readdir(repositoriesDirectory, {
        withFileTypes: true,
      });
      for (const repository of repositories) {
        if (!repository.isDirectory()) continue;
        const repositoryId = RepositoryIdSchema.safeParse(repository.name);
        if (!repositoryId.success) continue;
        const current = await this.readCurrent(repositoryId.data);
        for (const state of current.values()) {
          if (state.content.kind === "blob") referenced.add(state.content.sha256);
        }
        const manifest = await this.readManifest(repositoryId.data);
        for (const activityId of manifest.activityIds) {
          const activity = await this.readActivity(repositoryId.data, activityId);
          for (const change of activity.changes) {
            for (const state of [change.before, change.after]) {
              if (state?.content.kind === "blob") referenced.add(state.content.sha256);
            }
          }
        }
      }
      const objectsDirectory = join(this.storageDirectory(), "objects");
      const objects = await readdir(objectsDirectory, {
        withFileTypes: true,
      });
      await Promise.all(
        objects
          .filter((object) => object.isFile() && object.name.endsWith(".gz"))
          .filter((object) => !referenced.has(object.name.slice(0, -3)))
          .map((object) =>
            rm(join(objectsDirectory, object.name), {
              force: true,
            }),
          ),
      );
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }

  async archiveLegacy(repositoryId: RepositoryId): Promise<void> {
    const legacy = join(this.storageRoot, "local-history", repositoryId);
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
            file.kind === "symlink" || (isLocalHistoryTextPath(file.path) && isUtf8(bytes))
              ? {
                  kind: "blob",
                  sha256: await this.writeBlob(bytes),
                }
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
            version: LOCAL_HISTORY_STORAGE_VERSION,
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
        const changes = createLocalHistoryChanges(previous.state, current.state);
        if (changes.length === 0 && current.entry.label === null) continue;
        migrated.push(
          StoredActivitySchema.parse({
            version: LOCAL_HISTORY_STORAGE_VERSION,
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
        const activityDirectory = join(this.repositoryDirectory(repositoryId), "activities");
        await mkdir(activityDirectory, {
          recursive: true,
          mode: 0o700,
        });
        for (const activity of migrated) {
          await this.atomicJson(join(activityDirectory, `${activity.id}.json`), activity);
        }
        await this.writeManifest(repositoryId, migrated.map((activity) => activity.id).reverse());
      }
      const archive = join(this.storageRoot, "local-history-v1-archive");
      await mkdir(archive, { recursive: true, mode: 0o700 });
      await rename(legacy, join(archive, repositoryId)).catch((error: unknown) => {
        if (!isErrno(error, "EEXIST")) throw error;
      });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) return;
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }

  async quarantineCorruptRepository(repositoryId: RepositoryId): Promise<void> {
    const source = this.repositoryDirectory(repositoryId);
    const archive = join(this.storageRoot, "local-history-v2-corrupt");
    await mkdir(archive, { recursive: true, mode: 0o700 });
    await rename(source, join(archive, `${repositoryId}-${randomUUID()}`)).catch(
      (error: unknown) => {
        if (!isErrno(error, "ENOENT")) throw error;
      },
    );
  }

  async atomicJson(target: string, value: unknown): Promise<void> {
    await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, target);
  }

  storageDirectory(): string {
    return join(this.storageRoot, "local-history-v2");
  }

  repositoryDirectory(repositoryId: RepositoryId): string {
    return join(this.storageDirectory(), "repositories", RepositoryIdSchema.parse(repositoryId));
  }

  blobPath(sha256: string): string {
    return join(this.storageDirectory(), "objects", `${sha256}.gz`);
  }
}
